/**
 * Headless checks for iOS Save to Photos vs desktop download.
 *
 *   pnpm exec tsx scripts/verify-save-to-photos.ts --base-url http://127.0.0.1:3000
 *
 * Screenshots use waitUntil: load / domcontentloaded — never networkidle.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

const baseUrl = (
  argValue("--base-url") ||
  process.env.VERIFY_BASE_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");
const shareToken = argValue("--share-token") || process.env.VERIFY_SHARE_TOKEN || "";
const shotDir = process.env.VERIFY_SHOT_DIR || "/opt/cursor/artifacts";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const VIDEO_BODY = Buffer.alloc(64 * 1024, 7);

async function unlockPreview(page: import("playwright").Page) {
  if (!shareToken) return;
  await page.goto(`${baseUrl}/?_vercel_share=${shareToken}`, { waitUntil: "domcontentloaded" });
}

async function fulfillDownload(page: import("playwright").Page, delayMs = 400) {
  await page.route("**/api/clips/*/download**", async (route) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "video/mp4",
        "content-disposition": 'attachment; filename="IMG_1234.mp4"',
        "content-length": String(VIDEO_BODY.length),
        "x-downloads-remaining": "2",
      },
      body: VIDEO_BODY,
    });
  });
}

async function verifyIos(browser: import("playwright").Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
  });
  await context.addInitScript(() => {
    const calls: Array<{ name: string; type: string }> = [];
    Object.defineProperty(window, "__shareCalls", {
      configurable: true,
      writable: true,
      value: calls,
    });
    navigator.canShare = (data?: ShareData) => Boolean(data?.files && data.files.length > 0);
    navigator.share = async (data?: ShareData) => {
      for (const file of data?.files ?? []) {
        calls.push({ name: file.name, type: file.type });
      }
    };
  });

  const page = await context.newPage();
  await unlockPreview(page);
  await fulfillDownload(page, 800);
  await page.goto(`${baseUrl}/dev/download-pending`, { waitUntil: "domcontentloaded" });

  const button = page.locator('[data-verify-download-surface="feed"] [data-download-control]');
  await button.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-verify-download-surface="feed"] [data-download-control]')
        ?.getAttribute("data-download-mode") === "photos",
    null,
    { timeout: 5000 },
  );

  await button.click();
  const pending = page.locator('[data-download-pending="true"]');
  await pending.first().waitFor({ state: "visible", timeout: 5000 });
  const pendingLabel = await pending.first().innerText();
  if (!pendingLabel.includes("Preparing")) {
    throw new Error(`iOS pending label was "${pendingLabel}"`);
  }
  const busy = await pending.first().getAttribute("aria-busy");
  if (busy !== "true") {
    throw new Error(`iOS aria-busy should be true, got ${busy}`);
  }

  const ready = page.locator('[data-save-to-photos="ready"]');
  await ready.first().waitFor({ state: "visible", timeout: 10000 });
  const readyLabel = (await ready.first().innerText()).replace(/\s+/g, " ").trim();
  if (!readyLabel.includes("Save to Photos")) {
    throw new Error(`iOS ready label was "${readyLabel}"`);
  }
  const live = page.locator('[aria-live="polite"]').filter({ hasText: "Ready to save to Photos" });
  if ((await live.count()) === 0) {
    throw new Error("Missing aria-live ready-to-save announcement");
  }

  await page.screenshot({
    path: `${shotDir}/save-to-photos-ios-ready.png`,
    fullPage: true,
  });

  await ready.first().click();
  const shared = await page.evaluate(() => {
    return (window as unknown as { __shareCalls?: Array<{ name: string; type: string }> }).__shareCalls ?? [];
  });
  if (shared.length !== 1) {
    throw new Error(`expected one share call, got ${JSON.stringify(shared)}`);
  }
  if (shared[0]?.name !== "IMG_1234.mp4") {
    throw new Error(`share filename was ${shared[0]?.name}`);
  }
  if (shared[0]?.type !== "video/mp4") {
    throw new Error(`share mime was ${shared[0]?.type}`);
  }

  const stillReady = await ready.first().isVisible();
  if (!stillReady) {
    throw new Error("Save to Photos should stay available after a successful share");
  }

  await context.close();
  console.log("ok iPhone UA: preparing -> Save to Photos -> share");
}

async function verifyDesktop(browser: import("playwright").Browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: DESKTOP_UA,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await unlockPreview(page);
  await fulfillDownload(page, 200);
  await page.goto(`${baseUrl}/dev/download-pending`, { waitUntil: "load" });

  const button = page.locator('[data-verify-download-surface="session"] [data-download-control]');
  await button.waitFor({ state: "visible", timeout: 15000 });
  const mode = await button.getAttribute("data-download-mode");
  if (mode === "photos") {
    throw new Error("desktop UA should not use the Photos share path");
  }

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    button.click(),
  ]);
  const suggested = download.suggestedFilename();
  if (!suggested.endsWith(".mp4")) {
    throw new Error(`desktop download filename was ${suggested}`);
  }

  const saveReady = page.locator('[data-save-to-photos="ready"]');
  if ((await saveReady.count()) !== 0) {
    throw new Error("desktop download should not switch to Save to Photos");
  }
  const afterLabel = (await button.innerText()).replace(/\s+/g, " ").trim();
  if (afterLabel.includes("Save to Photos")) {
    throw new Error(`desktop button became "${afterLabel}"`);
  }

  await page.screenshot({
    path: `${shotDir}/save-to-photos-desktop.png`,
    fullPage: true,
  });

  await context.close();
  console.log("ok desktop UA: attachment download unchanged");
}

async function main() {
  await mkdir(shotDir, { recursive: true });
  const probeUrl = shareToken
    ? `${baseUrl}/dev/download-pending?_vercel_share=${shareToken}`
    : `${baseUrl}/dev/download-pending`;
  const probe = await fetch(probeUrl, { redirect: "manual" });
  if (probe.status >= 400) {
    throw new Error(
      `/dev/download-pending returned ${probe.status}. Use a preview URL or VERIFY_FEED_HARNESS=1`,
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    await verifyIos(browser);
    await verifyDesktop(browser);
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${shotDir}/save-to-photos-ios-ready.png`);
  console.log(`Wrote ${shotDir}/save-to-photos-desktop.png`);
  console.log("PASS: iOS Save to Photos states and desktop download");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
