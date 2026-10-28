/**
 * Headless check: after one unmute, swipe three clips and assert the
 * persistent player stays unmuted (video.muted === false).
 *
 *   node scripts/verify-feed-sound.mjs [baseUrl]
 */
import { chromium, webkit } from "playwright";

const baseUrl = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000";

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

async function playerState(page) {
  return page.evaluate(() => {
    const player = document.querySelector("video[data-feed-player]");
    const button = document.querySelector("[data-sound-control]");
    return {
      exists: Boolean(player),
      muted: player?.muted ?? null,
      src: player?.currentSrc || player?.src || "",
      pressed: button?.getAttribute("aria-pressed") ?? null,
    };
  });
}

async function swipeNext(page) {
  const before = await playerState(page);
  await page.evaluate(() => {
    const root = document.querySelector(".feed-scroller");
    if (!root) throw new Error("missing .feed-scroller");
    root.scrollBy({ top: root.clientHeight, behavior: "instant" });
  });
  await page.waitForFunction(
    (prevSrc) => {
      const player = document.querySelector("video[data-feed-player]");
      if (!player) return false;
      const src = player.currentSrc || player.src || "";
      return src.length > 0 && src !== prevSrc;
    },
    before.src,
    { timeout: 15000 },
  );
}

async function main() {
  const { browser, engine } = await launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  try {
    await page.goto(`${baseUrl}/?ym=2026-10`, { waitUntil: "domcontentloaded" });
    const firstWatch = page.locator('a[href*="/watch/"]').first();
    if ((await firstWatch.count()) === 0) {
      throw new Error("no watch links on home");
    }
    const href = await firstWatch.getAttribute("href");
    if (!href) throw new Error("watch link missing href");

    const match = href.match(/\/games\/([^/]+)\/watch\/([^/?#]+)/);
    if (!match) throw new Error(`unexpected watch href: ${href}`);
    const gameId = match[1];

    await page.goto(`${baseUrl}/games/${gameId}`, { waitUntil: "domcontentloaded" });
    const clipLinks = page.locator('a[href*="/watch/"]');
    const clipCount = await clipLinks.count();
    if (clipCount < 4) {
      throw new Error(`need at least 4 clips, found ${clipCount}`);
    }
    const startHref = await clipLinks.first().getAttribute("href");
    if (!startHref) throw new Error("first clip missing href");

    await page.goto(`${baseUrl}${startHref}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("video[data-feed-player]", { timeout: 15000 });
    await page.waitForSelector("[data-sound-control]", { timeout: 15000 });

    await page.locator("[data-sound-control]").click();
    await page.waitForFunction(() => {
      const player = document.querySelector("video[data-feed-player]");
      return Boolean(player) && player.muted === false;
    }, null, { timeout: 10000 });

    const afterUnmute = await playerState(page);
    if (afterUnmute.muted !== false) {
      throw new Error(`unmute left player muted: ${JSON.stringify(afterUnmute)}`);
    }
    if (afterUnmute.pressed !== "true") {
      throw new Error(`sound button out of sync after unmute: ${JSON.stringify(afterUnmute)}`);
    }
    console.log(`ok unmute on clip 1 (${engine})`, afterUnmute.src);

    for (let step = 1; step <= 3; step += 1) {
      await swipeNext(page);
      const state = await playerState(page);
      if (state.muted !== false) {
        throw new Error(`clip ${step + 1} played muted: ${JSON.stringify(state)}`);
      }
      if (state.pressed !== "true") {
        throw new Error(`sound button out of sync on clip ${step + 1}: ${JSON.stringify(state)}`);
      }
      console.log(`ok swipe ${step} unmuted`, state.src);
    }

    console.log(`PASS: one unmute, three swipes, video.muted === false (${engine})`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
