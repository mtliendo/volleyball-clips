/**
 * Headless check: keyboard moves the swipe feed.
 *
 *   VERIFY_FEED_HARNESS=1 node scripts/verify-feed-keys.mjs [baseUrl]
 */
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseUrl = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3001";
const shotDir = process.env.VERIFY_SHOT_DIR || "/opt/cursor/artifacts/screenshots";

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
    const fav = document.querySelector("[data-favorite-control]");
    const download = document.querySelector("[data-download-control]");
    return {
      clipId: root?.getAttribute("data-active-clip") ?? null,
      url: `${window.location.pathname}${window.location.search}`,
      favClip: fav?.getAttribute("data-clip-id") ?? null,
      downloadClip: download?.getAttribute("data-clip-id") ?? null,
      remaining: download?.getAttribute("data-download-remaining") ?? null,
      sheet: Boolean(document.querySelector("[data-pin-sheet]")),
    };
  });
}

async function waitForClip(page, previousId) {
  await page.waitForFunction(
    (prev) => {
      const id = document.querySelector("[data-active-clip]")?.getAttribute("data-active-clip");
      return Boolean(id) && id !== prev;
    },
    previousId,
    { timeout: 15000 },
  );
}

async function main() {
  await mkdir(shotDir, { recursive: true });
  const { browser, engine } = await launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    const harness = await page.goto(`${baseUrl}/dev/feed-keys`, {
      waitUntil: "domcontentloaded",
    });
    if (!harness || harness.status() >= 400) {
      throw new Error(
        `harness missing (${harness?.status() ?? "no response"}). Start the app with VERIFY_FEED_HARNESS=1`,
      );
    }
    await page.waitForSelector("[data-active-clip]", { timeout: 15000 });
    await page.waitForSelector("[data-download-control]", { timeout: 15000 });

    const first = await feedState(page);
    if (!first.clipId) throw new Error(`no active clip: ${JSON.stringify(first)}`);
    await page.waitForFunction(
      (id) => window.location.pathname.includes(`/watch/${id}`),
      first.clipId,
      { timeout: 5000 },
    );
    if (first.favClip !== first.clipId || first.downloadClip !== first.clipId) {
      throw new Error(`overlay not keyed to active clip: ${JSON.stringify(first)}`);
    }
    console.log(`ok start clip (${engine})`, first.clipId, first.url);

    await page.keyboard.press("ArrowDown");
    await waitForClip(page, first.clipId);
    const second = await feedState(page);
    if (second.clipId === first.clipId) {
      throw new Error(`ArrowDown did not change clip: ${JSON.stringify(second)}`);
    }
    if (!second.url.includes(`/watch/${second.clipId}`)) {
      throw new Error(`ArrowDown did not update URL: ${JSON.stringify(second)}`);
    }
    if (second.favClip !== second.clipId || second.downloadClip !== second.clipId) {
      throw new Error(`overlay drifted after ArrowDown: ${JSON.stringify(second)}`);
    }
    if (second.remaining !== first.remaining) {
      throw new Error(`remaining count reset after ArrowDown: ${JSON.stringify(second)}`);
    }
    await page.screenshot({ path: `${shotDir}/keyboard_arrow_down_clip_and_url.png` });
    console.log("ok ArrowDown", second.clipId, second.url);

    await page.keyboard.press("ArrowUp");
    await waitForClip(page, second.clipId);
    const back = await feedState(page);
    if (back.clipId !== first.clipId) {
      throw new Error(`ArrowUp did not return to first clip: ${JSON.stringify(back)}`);
    }
    if (!back.url.includes(`/watch/${first.clipId}`)) {
      throw new Error(`ArrowUp did not restore URL: ${JSON.stringify(back)}`);
    }
    console.log("ok ArrowUp", back.clipId, back.url);

    await page.keyboard.press("j");
    await waitForClip(page, first.clipId);
    const afterJ = await feedState(page);
    if (afterJ.clipId === first.clipId) {
      throw new Error(`j did not change clip: ${JSON.stringify(afterJ)}`);
    }
    await page.keyboard.press("k");
    await waitForClip(page, afterJ.clipId);
    console.log("ok j/k");

    await page.locator("[data-verify-input]").focus();
    const beforeInput = await feedState(page);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    const whileTyping = await feedState(page);
    if (whileTyping.clipId !== beforeInput.clipId) {
      throw new Error(`ArrowDown stole focus while typing: ${JSON.stringify(whileTyping)}`);
    }
    console.log("ok input ignores ArrowDown");

    await page.goto(`${baseUrl}/dev/feed-keys?as=admin`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-pin-control]", { timeout: 15000 });
    await page.locator("[data-pin-control]").click();
    await page.waitForSelector("[data-pin-sheet]", { timeout: 15000 });
    const beforeSheet = await feedState(page);
    if (!beforeSheet.sheet) throw new Error("tag sheet did not open");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    const whileSheet = await feedState(page);
    if (whileSheet.clipId !== beforeSheet.clipId) {
      throw new Error(`ArrowDown moved clip while tag sheet open: ${JSON.stringify(whileSheet)}`);
    }
    await page.screenshot({ path: `${shotDir}/keyboard_tag_sheet_ignores_arrows.png` });
    console.log("ok tag sheet ignores ArrowDown");

    console.log("PASS: keyboard moves clip and URL, ignores input and tag sheet");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
