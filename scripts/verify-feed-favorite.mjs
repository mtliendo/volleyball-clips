/**
 * Headless check: favorite is per clip in the vertical feed.
 *
 *   node --env-file=.env.local scripts/verify-feed-favorite.mjs [baseUrl]
 */
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import { chromium, webkit } from "playwright";

const baseUrl = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3001";
const TEST_SUB = "auth0|vbpov-feed-favorite-verify";

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

async function sessionCookie() {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) {
    throw new Error("AUTH0_SECRET is required to mint a test session");
  }
  const value = await generateSessionCookie(
    {
      user: {
        sub: TEST_SUB,
        email: "feed-favorite-verify@vbpov.test",
        name: "Feed Favorite Verify",
      },
    },
    { secret },
  );
  const url = new URL(baseUrl);
  return {
    name: "__session",
    value,
    domain: url.hostname,
    path: "/",
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "Lax",
  };
}

async function feedState(page) {
  return page.evaluate(() => {
    const fav = document.querySelector("[data-favorite-control]");
    const download = document.querySelector("[data-download-control]");
    const root = document.querySelector("[data-active-clip]");
    return {
      clipId: root?.getAttribute("data-active-clip") ?? null,
      favorited: fav?.getAttribute("aria-pressed") ?? null,
      favClip: fav?.getAttribute("data-clip-id") ?? null,
      downloadClip: download?.getAttribute("data-clip-id") ?? null,
      pin: document.querySelector("[data-pin-badge]")?.getAttribute("data-pin-badge") ?? null,
    };
  });
}

async function swipeBy(page, direction) {
  const before = await feedState(page);
  await page.evaluate((delta) => {
    const root = document.querySelector(".feed-scroller");
    if (!root) throw new Error("missing .feed-scroller");
    root.scrollBy({ top: delta * root.clientHeight, behavior: "instant" });
  }, direction);
  await page.waitForFunction(
    (prev) => {
      const root = document.querySelector("[data-active-clip]");
      const id = root?.getAttribute("data-active-clip");
      return Boolean(id) && id !== prev;
    },
    before.clipId,
    { timeout: 15000 },
  );
}

async function openFeed(page) {
  await page.goto(`${baseUrl}/?ym=2026-10`, { waitUntil: "domcontentloaded" });
  const firstWatch = page.locator('a[href*="/watch/"]').first();
  const href = await firstWatch.getAttribute("href");
  if (!href) throw new Error("no watch links on home");
  const match = href.match(/\/games\/([^/]+)/);
  if (!match) throw new Error(`unexpected watch href: ${href}`);
  const gameId = match[1];

  await page.goto(`${baseUrl}/games/${gameId}`, { waitUntil: "domcontentloaded" });
  const clipLinks = page.locator('a[href*="/watch/"]');
  if ((await clipLinks.count()) < 3) {
    throw new Error("need at least 3 clips");
  }
  const startHref = await clipLinks.first().getAttribute("href");
  if (!startHref) throw new Error("first clip missing href");
  await page.goto(`${baseUrl}${startHref}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-favorite-control]", { timeout: 15000 });
  await page.waitForSelector("[data-active-clip]", { timeout: 15000 });
  return startHref;
}

async function main() {
  const cookie = await sessionCookie();
  const { browser, engine } = await launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await context.addCookies([cookie]);
  const page = await context.newPage();

  try {
    const startHref = await openFeed(page);
    const first = await feedState(page);
    if (first.favorited === null) {
      throw new Error(`favorite control missing: ${JSON.stringify(first)}`);
    }
    if (first.favClip !== first.clipId || first.downloadClip !== first.clipId) {
      throw new Error(`overlay not keyed to active clip: ${JSON.stringify(first)}`);
    }

    if (first.favorited === "true") {
      await page.locator("[data-favorite-control]").click();
      await page.waitForFunction(() => {
        return document.querySelector("[data-favorite-control]")?.getAttribute("aria-pressed") === "false";
      });
    }

    await page.locator("[data-favorite-control]").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-favorite-control]")?.getAttribute("aria-pressed") === "true";
    });
    const favoritedOne = await feedState(page);
    if (favoritedOne.favorited !== "true") {
      throw new Error(`clip 1 did not favorite: ${JSON.stringify(favoritedOne)}`);
    }
    const clip1 = favoritedOne.clipId;
    console.log(`ok favorite clip 1 (${engine})`, clip1);

    const seen = [clip1];
    for (const step of [2, 3]) {
      await swipeBy(page, 1);
      const state = await feedState(page);
      if (state.favorited !== "false") {
        throw new Error(`clip ${step} showed favorited: ${JSON.stringify(state)}`);
      }
      if (state.clipId === clip1 || seen.includes(state.clipId)) {
        throw new Error(`swipe ${step} did not change clip: ${JSON.stringify(state)}`);
      }
      if (state.favClip !== state.clipId || state.downloadClip !== state.clipId) {
        throw new Error(`overlay drifted from active clip: ${JSON.stringify(state)}`);
      }
      seen.push(state.clipId);
      console.log(`ok swipe to clip ${step} not favorited`, state.clipId);
    }

    await swipeBy(page, -1);
    await swipeBy(page, -1);
    const back = await feedState(page);
    if (back.clipId !== clip1) {
      throw new Error(`did not return to clip 1: ${JSON.stringify(back)}`);
    }
    if (back.favorited !== "true") {
      throw new Error(`clip 1 lost favorite after swipe back: ${JSON.stringify(back)}`);
    }
    console.log("ok swipe back to clip 1 still favorited");

    await page.locator("[data-favorite-control]").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-favorite-control]")?.getAttribute("aria-pressed") === "false";
    });
    const unfav = await feedState(page);
    if (unfav.favorited !== "false") {
      throw new Error(`unfavorite failed: ${JSON.stringify(unfav)}`);
    }
    console.log("ok unfavorite clip 1");

    await page.locator("[data-favorite-control]").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-favorite-control]")?.getAttribute("aria-pressed") === "true";
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-favorite-control]", { timeout: 15000 });
    await page.waitForFunction(() => {
      return document.querySelector("[data-favorite-control]")?.getAttribute("aria-pressed") === "true";
    }, null, { timeout: 15000 });
    const reloaded = await feedState(page);
    if (reloaded.clipId !== clip1 || reloaded.favorited !== "true") {
      throw new Error(`reload did not persist favorite: ${JSON.stringify(reloaded)}`);
    }
    console.log("ok reload persists favorite");

    await page.locator("[data-favorite-control]").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-favorite-control]")?.getAttribute("aria-pressed") === "false";
    });
    await page.goto(`${baseUrl}${startHref}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-favorite-control]", { timeout: 15000 });
    const cleaned = await feedState(page);
    if (cleaned.favorited !== "false") {
      throw new Error(`cleanup unfavorite did not persist: ${JSON.stringify(cleaned)}`);
    }

    console.log("PASS: favorite is per clip, swipe-back and reload match");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
