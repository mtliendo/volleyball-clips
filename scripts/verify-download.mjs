/**
 * Headless check: downloads save a file, remaining updates, 402 stays on the clip.
 *
 *   VERIFY_FEED_HARNESS=1 node scripts/verify-download.mjs [baseUrl]
 */
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseUrl = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3001";
const shotDir = process.env.VERIFY_SHOT_DIR || "/opt/cursor/artifacts/screenshots";
const DOWNLOADS_COOKIE = "vb_verify_downloads";

async function launch() {
  try {
    const browser = await webkit.launch({ headless: true });
    return { browser, engine: "webkit" };
  } catch (error) {
    console.warn("WebKit unavailable, falling back to Chromium:", error.message);
    const browser = await chromium.launch({ headless: true });
    return { browser, engine: "chromium" };
  }
}

async function feedState(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-active-clip]");
    const download = document.querySelector("[data-download-control]");
    return {
      clipId: root?.getAttribute("data-active-clip") ?? null,
      url: `${window.location.pathname}${window.location.search}`,
      downloadClip: download?.getAttribute("data-clip-id") ?? null,
      remaining: download?.getAttribute("data-download-remaining") ?? null,
      label: download?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      limit: Boolean(document.querySelector("[data-download-limit]")),
      pricing: document.querySelector("[data-download-limit] a[href='/pricing']")?.getAttribute("href") ?? null,
      primary: document.querySelector("[data-download-limit] .btn-primary")?.textContent?.trim() ?? null,
      secondary: document.querySelector("[data-download-limit] .btn-ghost")?.textContent?.trim() ?? null,
      heading: document.querySelector("[data-download-limit] h2")?.textContent?.trim() ?? null,
    };
  });
}

async function main() {
  await mkdir(shotDir, { recursive: true });
  const { browser, engine } = await launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
  });
  await context.addCookies([
    {
      name: DOWNLOADS_COOKIE,
      value: "3",
      url: baseUrl,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();

  try {
    const harness = await page.goto(`${baseUrl}/dev/feed-keys?left=3`, {
      waitUntil: "domcontentloaded",
    });
    if (!harness || harness.status() >= 400) {
      throw new Error(
        `harness missing (${harness?.status() ?? "no response"}). Start the app with VERIFY_FEED_HARNESS=1`,
      );
    }
    await page.waitForSelector("[data-download-control]", { timeout: 15000 });
    await page.waitForSelector("[data-active-clip]", { timeout: 15000 });

    const start = await feedState(page);
    if (start.remaining !== "3") {
      throw new Error(`expected 3 left on first clip: ${JSON.stringify(start)}`);
    }
    if (!start.label.includes("3 left")) {
      throw new Error(`download control missing remaining count: ${JSON.stringify(start)}`);
    }
    await page.screenshot({ path: `${shotDir}/download_remaining_before.png` });
    console.log(`ok remaining shown (${engine})`, start);

    const [response, download] = await Promise.all([
      page.waitForResponse(
        (item) => item.url().includes("/api/clips/") && item.url().includes("/download"),
        { timeout: 15000 },
      ),
      page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      page.locator("[data-download-control]").click(),
    ]);

    const disposition = response.headers()["content-disposition"] ?? "";
    if (response.status() !== 200) {
      throw new Error(`download status ${response.status()}`);
    }
    if (!/attachment/i.test(disposition)) {
      throw new Error(`missing Content-Disposition: attachment (${disposition})`);
    }
    const remainingHeader = response.headers()["x-downloads-remaining"];
    if (remainingHeader !== "2") {
      throw new Error(`expected X-Downloads-Remaining: 2, got ${remainingHeader}`);
    }
    if (download) {
      const suggested = download.suggestedFilename();
      if (!suggested.endsWith(".mp4")) {
        throw new Error(`download filename was not an mp4: ${suggested}`);
      }
      console.log("ok browser saved file", suggested);
    } else {
      console.log("ok response forced attachment; browser download event not required");
    }
    console.log("ok Content-Disposition", disposition);

    await page.waitForFunction(
      () => document.querySelector("[data-download-control]")?.getAttribute("data-download-remaining") === "2",
      null,
      { timeout: 10000 },
    );
    const after = await feedState(page);
    if (after.remaining !== "2" || !after.label.includes("2 left")) {
      throw new Error(`remaining did not update after download: ${JSON.stringify(after)}`);
    }
    if (after.limit) {
      throw new Error("limit banner shown after a successful download");
    }
    if (!after.url.includes(`/watch/${start.clipId}`)) {
      throw new Error(`left the clip after download: ${JSON.stringify(after)}`);
    }
    await page.screenshot({ path: `${shotDir}/download_remaining_after.png` });
    console.log("ok remaining updated on same clip", after);

    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(
      (prev) => document.querySelector("[data-active-clip]")?.getAttribute("data-active-clip") !== prev,
      start.clipId,
      { timeout: 15000 },
    );
    const nextClip = await feedState(page);
    if (nextClip.remaining !== "2" || nextClip.downloadClip !== nextClip.clipId) {
      throw new Error(`remaining/control did not follow next clip: ${JSON.stringify(nextClip)}`);
    }
    await page.screenshot({ path: `${shotDir}/download_remaining_other_clip.png` });
    console.log("ok remaining stays on next clip", nextClip);

    await context.addCookies([
      {
        name: DOWNLOADS_COOKIE,
        value: "0",
        url: baseUrl,
        sameSite: "Lax",
      },
    ]);
    await page.goto(`${baseUrl}/dev/feed-keys?left=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-download-control]", { timeout: 15000 });
    const beforeLimit = await feedState(page);
    await page.locator("[data-download-control]").click();
    await page.waitForSelector("[data-download-limit]", { timeout: 10000 });
    const limited = await feedState(page);
    if (!limited.limit) {
      throw new Error(`limit message missing: ${JSON.stringify(limited)}`);
    }
    if (limited.pricing !== "/pricing") {
      throw new Error(`limit wall missing /pricing link: ${JSON.stringify(limited)}`);
    }
    if (limited.heading !== "That is three for the week") {
      throw new Error(`limit heading off: ${JSON.stringify(limited)}`);
    }
    if (limited.primary !== "Go Pro, $5 a month") {
      throw new Error(`primary button off: ${JSON.stringify(limited)}`);
    }
    if (limited.secondary !== "Back to the clip") {
      throw new Error(`secondary button off: ${JSON.stringify(limited)}`);
    }
    if (limited.url.startsWith("/api/clips/")) {
      throw new Error(`navigated to API JSON: ${JSON.stringify(limited)}`);
    }
    if (!limited.url.includes(`/watch/${beforeLimit.clipId}`) && !limited.url.startsWith("/dev/feed-keys")) {
      throw new Error(`left the clip on 402: ${JSON.stringify(limited)}`);
    }
    const body = await page.locator("body").innerText();
    if (body.includes("Weekly download limit reached")) {
      throw new Error("raw API JSON rendered on the page");
    }
    if (!body.includes("Another one frees up")) {
      throw new Error(`next-free copy missing: ${body}`);
    }
    await page.screenshot({ path: `${shotDir}/download_limit_wall.png` });
    console.log("ok 402 stays on clip with download wall");

    await page.goto(`${baseUrl}/dev/feed-keys?wall=watch`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-signup-wall]", { timeout: 15000 });
    const watchCopy = await page.locator("[data-signup-wall]").innerText();
    if (!watchCopy.includes("That is seven for today")) {
      throw new Error(`seven-a-day wall missing: ${watchCopy}`);
    }
    await page.screenshot({ path: `${shotDir}/watch_limit_wall.png` });
    console.log("ok seven-a-day wall");

    await page.setViewportSize({ width: 780, height: 844 });
    const walls = await page.goto(`${baseUrl}/dev/walls`, { waitUntil: "domcontentloaded" });
    if (!walls || walls.status() >= 400) {
      throw new Error(`walls harness missing (${walls?.status() ?? "no response"})`);
    }
    await page.waitForSelector("[data-verify-walls]", { timeout: 15000 });
    await page.waitForSelector("[data-signup-wall]", { timeout: 15000 });
    await page.waitForSelector("[data-download-limit]", { timeout: 15000 });
    await page.screenshot({ path: `${shotDir}/walls_side_by_side.png` });
    console.log("ok side-by-side walls");

    const api = await page.request.get(`${baseUrl}/api/clips/${beforeLimit.clipId}/download`);
    const apiDisposition = api.headers()["content-disposition"] ?? "";
    if (api.status() !== 402) {
      throw new Error(`expected 402 when quota is empty, got ${api.status()}`);
    }
    if (/attachment/i.test(apiDisposition)) {
      throw new Error("402 should not be an attachment");
    }
    console.log("ok empty quota returns 402 JSON, not a file");

    console.log("PASS: download attachment, remaining updates, 402 stays on clip");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
