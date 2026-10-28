/**
 * Headless check: admin tag sheet (session pin + play type).
 *
 *   VERIFY_FEED_HARNESS=1 node scripts/verify-feed-admin-tags.mjs [baseUrl]
 */
import { chromium, webkit } from "playwright";

const baseUrl = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3001";
const PIN_COOKIE = "vb_verify_pins";
const PLAY_COOKIE = "vb_verify_play_tags";

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
    return {
      clipId: root?.getAttribute("data-active-clip") ?? null,
      pinControl: Boolean(document.querySelector("[data-pin-control]")),
      pinBadge: document.querySelector("[data-pin-badge]")?.getAttribute("data-pin-badge") ?? null,
      sheet: Boolean(document.querySelector("[data-pin-sheet]")),
      emptyFilter: document.querySelector("[data-filter-empty]")?.getAttribute("data-filter-empty") ?? null,
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
    (prev) => document.querySelector("[data-active-clip]")?.getAttribute("data-active-clip") !== prev,
    before.clipId,
    { timeout: 15000 },
  );
}

async function main() {
  const { browser, engine } = await launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const pins = {};
  const play = {};

  await page.route("**/api/admin/clips/**", async (route) => {
    const request = route.request();
    if (request.method() !== "PUT") {
      await route.continue();
      return;
    }
    const url = request.url();
    const body = request.postDataJSON() ?? {};
    const clipMatch = url.match(/\/api\/admin\/clips\/([^/]+)\//);
    const clipId = clipMatch?.[1];
    if (url.includes("/pin") && clipId) {
      const label = body.label ?? null;
      if (label) {
        for (const [id, value] of Object.entries(pins)) {
          if (value === label && id !== clipId) {
            pins[id] = null;
          }
        }
      }
      pins[clipId] = label;
    }
    await context.addCookies([
      { name: PIN_COOKIE, value: JSON.stringify(pins), url: baseUrl, sameSite: "Lax" },
      { name: PLAY_COOKIE, value: JSON.stringify(play), url: baseUrl, sameSite: "Lax" },
    ]);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  try {
    const anonWatch = await page.goto(`${baseUrl}/?ym=2026-10`, { waitUntil: "domcontentloaded" });
    if (!anonWatch || anonWatch.status() >= 400) {
      throw new Error("home failed");
    }
    const watchHref = await page.locator('a[href*="/watch/"]').first().getAttribute("href");
    if (!watchHref) throw new Error("no watch link");
    await page.goto(`${baseUrl}${watchHref}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".feed-scroller", { timeout: 15000 });
    if ((await page.locator("[data-pin-control]").count()) !== 0) {
      throw new Error("anonymous viewer saw the admin tag control");
    }
    const clipIdFromPath = watchHref.match(/\/watch\/([^/?#]+)/)?.[1];
    const anonPin = await page.request.put(`${baseUrl}/api/admin/clips/${clipIdFromPath}/pin`, {
      data: { label: "longest_rally" },
    });
    if (anonPin.status() !== 401 && anonPin.status() !== 403) {
      throw new Error(`anonymous pin API should reject, got ${anonPin.status()}`);
    }
    const anonTags = await page.request.put(`${baseUrl}/api/admin/clips/${clipIdFromPath}/tags`, {
      data: { tagIds: [] },
    });
    if (anonTags.status() !== 401 && anonTags.status() !== 403) {
      throw new Error(`anonymous tags API should reject, got ${anonTags.status()}`);
    }
    console.log(`ok anonymous hidden + API rejected (${engine})`);

    await page.goto(`${baseUrl}/dev/feed-admin?as=user`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".feed-scroller", { timeout: 15000 });
    if ((await page.locator("[data-pin-control]").count()) !== 0) {
      throw new Error("non-admin viewer saw the admin tag control");
    }
    console.log("ok non-admin hidden");

    await page.goto(`${baseUrl}/dev/feed-admin?as=admin`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-pin-control]", { timeout: 15000 });
    const first = await feedState(page);
    if (!first.pinControl || !first.clipId) {
      throw new Error(`admin missing tag control: ${JSON.stringify(first)}`);
    }
    const clip1 = first.clipId;

    await page.locator("[data-pin-control]").click();
    await page.waitForSelector("[data-pin-sheet]", { timeout: 8000 });
    if ((await page.locator("[data-pin-option='longest_rally']").count()) === 0) {
      throw new Error("session pin options missing");
    }
    if ((await page.locator("[data-play-tag]").count()) === 0) {
      throw new Error("play-type tags missing");
    }
    await page.screenshot({
      path: "/opt/cursor/artifacts/screenshots/admin_tag_sheet.png",
      fullPage: false,
    });
    console.log("ok admin sheet open (screenshot saved)");

    await page.locator("[data-pin-option='longest_rally']").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-pin-badge]")?.getAttribute("data-pin-badge") === "longest_rally";
    });
    pins[clip1] = "longest_rally";
    console.log("ok set longest rally on clip 1");

    await page.locator("[data-pin-sheet] >> text=Done").click();
    await swipeBy(page, 1);
    const clip2state = await feedState(page);
    const clip2 = clip2state.clipId;
    if (!clip2 || clip2 === clip1) {
      throw new Error("did not reach clip 2");
    }
    if (clip2state.pinBadge === "longest_rally") {
      throw new Error("clip 2 inherited clip 1 pin");
    }

    await page.locator("[data-pin-control]").click();
    await page.waitForSelector("[data-pin-sheet]");
    const moveHint = page.locator("[data-pin-option='longest_rally'] [data-pin-move]");
    if ((await moveHint.count()) === 0) {
      throw new Error("missing 'moves from another clip' hint");
    }
    await page.locator("[data-pin-option='longest_rally']").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-pin-badge]")?.getAttribute("data-pin-badge") === "longest_rally";
    });
    console.log("ok moved longest rally to clip 2");

    await swipeBy(page, -1);
    const back = await feedState(page);
    if (back.clipId !== clip1) {
      throw new Error("did not return to clip 1");
    }
    if (back.pinBadge === "longest_rally") {
      throw new Error("clip 1 still showed the moved pin");
    }
    console.log("ok clip 1 cleared after move");

    await page.locator("[data-pin-control]").click();
    await page.waitForSelector("[data-pin-sheet]");
    await page.locator("[data-pin-option='best_dig']").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-pin-badge]")?.getAttribute("data-pin-badge") === "best_dig";
    });
    await page.locator("[data-pin-option='none']").click();
    await page.waitForFunction(() => !document.querySelector("[data-pin-badge]"));
    console.log("ok clear pin");

    const playType = page.locator("[data-play-tag='serve']");
    if ((await playType.count()) === 0) {
      throw new Error("serve play type missing");
    }
    await playType.click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-play-tag='serve']")?.getAttribute("aria-pressed") === "true";
    });
    play[clip1] = ["serve"];
    await context.addCookies([
      { name: PLAY_COOKIE, value: JSON.stringify(play), url: baseUrl, sameSite: "Lax" },
    ]);
    console.log("ok set play type serve");

    await page.goto(`${baseUrl}/dev/feed-admin?as=admin&tag=serve`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-active-clip], [data-filter-empty]", { timeout: 15000 });
    const filtered = await feedState(page);
    if (filtered.emptyFilter === "serve") {
      throw new Error("clip did not appear under serve filter");
    }
    if (filtered.clipId !== clip1) {
      throw new Error(`serve filter started on ${filtered.clipId}, expected ${clip1}`);
    }
    console.log("ok clip appears under serve filter", filtered.clipId);

    await page.goto(`${baseUrl}/dev/feed-admin?as=admin`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-pin-control]", { timeout: 15000 });
    await page.locator("[data-pin-control]").click();
    await page.waitForSelector("[data-play-tag='serve']");
    await page.locator("[data-play-tag='serve']").click();
    await page.waitForFunction(() => {
      return document.querySelector("[data-play-tag='serve']")?.getAttribute("aria-pressed") === "false";
    });
    play[clip1] = [];
    await context.addCookies([
      { name: PLAY_COOKIE, value: JSON.stringify(play), url: baseUrl, sameSite: "Lax" },
    ]);
    await page.goto(`${baseUrl}/dev/feed-admin?as=admin&tag=serve`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-filter-empty='serve'], [data-active-clip]", { timeout: 15000 });
    const cleared = await feedState(page);
    if (cleared.emptyFilter !== "serve") {
      throw new Error(`expected empty serve filter after clear: ${JSON.stringify(cleared)}`);
    }
    console.log("ok play type clear removes clip from filter");

    console.log(`PASS: admin tags (${engine})`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
