/**
 * Phase 1 + 2 media lockdown checks. Point this at preview or production.
 *
 *   pnpm verify:lockdown -- --base-url https://vbpov.com --cdn-url https://dxxx.cloudfront.net
 *
 * Env alternatives: VERIFY_BASE_URL, VERIFY_CDN_URL, VERIFY_WATCH_URL,
 * VERIFY_ORIGINAL_KEY, VERIFY_PLAYBACK_KEY, VERIFY_FREE_COOKIE, VERIFY_PRO_COOKIE,
 * VERIFY_SKIP_FEED=1, VERIFY_EXPECT_UNLOCKED=1, VERIFY_EXPECT_PLAYBACK_UNLOCKED=1,
 * VERIFY_OIDC_TOKEN (Vercel preview protection), VERIFY_FEED_COOKIE (signed-in feed)
 *
 * Cookies are raw Cookie header values (Auth0 session). Install browsers with:
 *   pnpm exec playwright install chromium
 *
 * Screenshots use waitUntil: domcontentloaded / load — never networkidle.
 */
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Browser, type Page, type Response } from "playwright";

const LEAK_RE = /uploads\/|"originalKey"|original_key|originalKey=/i;
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type Args = {
  baseUrl: string;
  cdnUrl: string;
  watchUrl: string | null;
  originalKey: string | null;
  playbackKey: string | null;
  freeCookie: string | null;
  proCookie: string | null;
  skipFeed: boolean;
  expectUploadsUnlocked: boolean;
  expectPlaybackUnlocked: boolean;
  shotDir: string;
};

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function parseArgs(): Args {
  const baseUrl = (
    argValue("--base-url") ||
    process.env.VERIFY_BASE_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
  const cdnUrl = (
    argValue("--cdn-url") ||
    process.env.VERIFY_CDN_URL ||
    process.env.NEXT_PUBLIC_CDN_URL ||
    ""
  ).replace(/\/$/, "");
  if (!cdnUrl) {
    throw new Error("Pass --cdn-url or set VERIFY_CDN_URL / NEXT_PUBLIC_CDN_URL");
  }

  return {
    baseUrl,
    cdnUrl,
    watchUrl: argValue("--watch-url") || process.env.VERIFY_WATCH_URL || null,
    originalKey: argValue("--original-key") || process.env.VERIFY_ORIGINAL_KEY || null,
    playbackKey: argValue("--playback-key") || process.env.VERIFY_PLAYBACK_KEY || null,
    freeCookie: argValue("--free-cookie") || process.env.VERIFY_FREE_COOKIE || null,
    proCookie: argValue("--pro-cookie") || process.env.VERIFY_PRO_COOKIE || null,
    skipFeed: process.argv.includes("--skip-feed") || process.env.VERIFY_SKIP_FEED === "1",
    expectUploadsUnlocked: process.env.VERIFY_EXPECT_UNLOCKED === "1",
    expectPlaybackUnlocked: process.env.VERIFY_EXPECT_PLAYBACK_UNLOCKED === "1",
    shotDir: process.env.VERIFY_SHOT_DIR || "test-results",
  };
}

function cookieHeaders(cookie: string | null): HeadersInit {
  return cookie ? { Cookie: cookie } : {};
}

const __bypass = process.env.VERIFY_OIDC_TOKEN;
const __origFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const base = (
    argValue("--base-url") ||
    process.env.VERIFY_BASE_URL ||
    ""
  ).replace(/\/$/, "");
  if (__bypass && base && u.startsWith(base)) {
    const h = new Headers(init?.headers);
    h.set("x-vercel-trusted-oidc-idp-token", __bypass);
    init = { ...init, headers: h };
  }
  return __origFetch(input, init);
}) as typeof fetch;

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  return { response, text };
}

function assertNoLeak(label: string, body: string) {
  const match = body.match(LEAK_RE);
  if (match) {
    throw new Error(`${label} leaked original media key (${match[0]})`);
  }
}

function isMediaUrl(url: string) {
  return /\/playback\/|\.mp4(?:\?|$)|\/uploads\//i.test(url);
}

function objectUrl(cdnUrl: string, key: string) {
  return `${cdnUrl}/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function signingDenied(body: string) {
  return /Key-Pair-Id|MissingKey|signed request/i.test(body);
}

async function checkUnsignedUploads(cdnUrl: string, originalKey: string | null) {
  const probeKey = originalKey || "uploads/lockdown-probe/not-a-real-clip/original.mp4";
  const url = objectUrl(cdnUrl, probeKey);
  const response = await fetch(url, { method: "GET", redirect: "manual" });
  const body = await response.text();
  if (response.status !== 403 || !signingDenied(body)) {
    throw new Error(
      `unsigned ${probeKey} returned ${response.status}; expected 403 from CloudFront trusted key groups (Missing Key-Pair-Id). Body: ${body.slice(0, 240)}`,
    );
  }
  console.log("ok unsigned uploads/* -> 403 (CloudFront requires a signed URL)", probeKey);
}

async function checkUnsignedPlayback(cdnUrl: string, playbackKey: string) {
  const url = objectUrl(cdnUrl, playbackKey);
  const response = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-1" },
    redirect: "manual",
  });
  const body = await response.text();
  if (response.status !== 403 || !signingDenied(body)) {
    throw new Error(
      `unsigned ${playbackKey} returned ${response.status}; expected 403 from CloudFront trusted key groups (Missing Key-Pair-Id). Body: ${body.slice(0, 240)}`,
    );
  }
  console.log("ok unsigned playback/* -> 403 (CloudFront requires a signed URL)", playbackKey);
}

async function checkPlaybackStillPublic(cdnUrl: string, playbackKey: string) {
  const url = objectUrl(cdnUrl, playbackKey);
  const response = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-1" },
    redirect: "manual",
  });
  await response.body?.cancel();
  if (response.status !== 200 && response.status !== 206) {
    throw new Error(`playback ${playbackKey} returned ${response.status}; expected 200/206`);
  }
  console.log(`ok playback still ${response.status} (lockPlayback=false)`, playbackKey);
}

async function checkPostersStillPublic(cdnUrl: string, posterKey: string | null) {
  if (!posterKey) {
    console.warn("warn skip posters/* public check (no poster key in HTML)");
    return;
  }
  const url = objectUrl(cdnUrl, posterKey);
  const response = await fetch(url, { method: "GET", redirect: "manual" });
  await response.body?.cancel();
  if (response.status !== 200 && response.status !== 206) {
    throw new Error(`poster ${posterKey} returned ${response.status}; expected 200/206 (posters stay public)`);
  }
  console.log("ok posters/* still public", posterKey, response.status);
}

function extractPlaybackKeys(html: string) {
  const keys = new Set<string>();
  const re = /playback\/[0-9a-f-]+\/[0-9a-f-]+\/playback\.mp4/gi;
  for (const match of html.matchAll(re)) {
    keys.add(match[0]);
  }
  return [...keys];
}

function extractPosterKeys(html: string) {
  const keys = new Set<string>();
  const re = /posters\/[0-9a-f-]+\/[0-9a-f-]+\/poster\.jpg/gi;
  for (const match of html.matchAll(re)) {
    keys.add(match[0]);
  }
  return [...keys];
}

function extractWatchPaths(html: string) {
  const paths = new Set<string>();
  const re = /\/games\/[0-9a-f-]+\/watch\/[0-9a-f-]+/gi;
  for (const match of html.matchAll(re)) {
    paths.add(match[0].split("?")[0]);
  }
  return [...paths];
}

function extractClipId(watchPath: string) {
  const parts = watchPath.split("/").filter(Boolean);
  return parts[3] && UUID_RE.test(parts[3]) ? parts[3] : null;
}

async function discoverWatchPath(baseUrl: string, explicit: string | null) {
  if (explicit) {
    return explicit.startsWith("http")
      ? new URL(explicit).pathname
      : explicit.startsWith("/")
        ? explicit
        : `/${explicit}`;
  }

  const home = await fetchText(`${baseUrl}/`);
  const fromHome = extractWatchPaths(home.text);
  if (fromHome[0]) return fromHome[0];

  throw new Error("Could not find a /games/{id}/watch/{clipId} link. Pass --watch-url");
}

async function checkHtmlAndApis(baseUrl: string, watchPath: string) {
  const watch = await fetchText(`${baseUrl}${watchPath}`);
  if (!watch.response.ok) {
    throw new Error(`watch page ${watchPath} returned ${watch.response.status}`);
  }
  assertNoLeak(`watch HTML ${watchPath}`, watch.text);
  console.log("ok watch HTML has no uploads/ keys");

  const gameMatch = watchPath.match(/^\/games\/([^/]+)\//);
  if (gameMatch) {
    const game = await fetchText(`${baseUrl}/games/${gameMatch[1]}`);
    if (game.response.ok) {
      assertNoLeak(`game HTML /games/${gameMatch[1]}`, game.text);
      console.log("ok game HTML has no uploads/ keys");
    }
  }

  const clipId = extractClipId(watchPath);
  if (clipId) {
    const watchApi = await fetchText(`${baseUrl}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId }),
    });
    assertNoLeak("POST /api/watch", watchApi.text);
    console.log("ok /api/watch JSON has no uploads/ keys");
    if (watchApi.response.ok) {
      const payload = JSON.parse(watchApi.text) as {
        allowed?: boolean;
        playback?: { playbackUrl?: string } | null;
      };
      if (payload.allowed && payload.playback?.playbackUrl) {
        console.log("ok /api/watch issued a playback URL after allow");
      }
    }
  }

  return { html: watch.text, clipId };
}

async function checkDownloadAuth(
  baseUrl: string,
  clipId: string | null,
  freeCookie: string | null,
  proCookie: string | null,
) {
  if (!clipId) {
    throw new Error("Need a clip id for download checks");
  }

  const anon = await fetch(`${baseUrl}/api/clips/${clipId}/download`, {
    redirect: "manual",
  });
  await anon.body?.cancel();
  if (anon.status !== 401) {
    throw new Error(`download with no session returned ${anon.status}; expected 401`);
  }
  console.log("ok download without session -> 401");

  if (freeCookie) {
    const original = await fetch(
      `${baseUrl}/api/clips/${clipId}/download?quality=original`,
      { headers: cookieHeaders(freeCookie), redirect: "manual" },
    );
    const originalText = await original.text();
    if (original.status === 200) {
      throw new Error("free session was able to download ?quality=original");
    }
    if (original.status !== 403 && original.status !== 402) {
      throw new Error(
        `free ?quality=original returned ${original.status}; expected 403 (or 402 if quota is empty)`,
      );
    }
    if (/attachment/i.test(original.headers.get("content-disposition") ?? "")) {
      throw new Error("free ?quality=original returned an attachment");
    }
    assertNoLeak("free original download JSON", originalText);
    console.log(`ok free session cannot get ?quality=original (${original.status})`);
  } else {
    console.warn("warn skip free-session original check (set VERIFY_FREE_COOKIE)");
  }

  if (proCookie) {
    const pro = await fetch(`${baseUrl}/api/clips/${clipId}/download?quality=original`, {
      headers: cookieHeaders(proCookie),
      redirect: "manual",
    });
    const disposition = pro.headers.get("content-disposition") ?? "";
    if (pro.status !== 200) {
      const body = await pro.text();
      throw new Error(`Pro original download returned ${pro.status}: ${body.slice(0, 240)}`);
    }
    if (!/attachment/i.test(disposition)) {
      await pro.body?.cancel();
      throw new Error(`Pro original missing Content-Disposition: attachment (${disposition})`);
    }
    await pro.body?.cancel();
    console.log("ok Pro original is an attachment", disposition);
  } else {
    console.warn("warn skip Pro attachment check (set VERIFY_PRO_COOKIE)");
  }
}

async function launchBrowser(): Promise<{ browser: Browser; engine: string }> {
  try {
    const browser = await webkit.launch({ headless: true });
    return { browser, engine: "webkit" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("WebKit unavailable, falling back to Chromium:", message);
    const browser = await chromium.launch({ headless: true });
    return { browser, engine: "chromium" };
  }
}

async function playerSnapshot(page: Page) {
  return page.evaluate(() => {
    const player = document.querySelector<HTMLVideoElement>("video[data-feed-player]");
    const audioTracks =
      "audioTracks" in (player ?? {})
        ? (player as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks
            ?.length ?? null
        : null;
    return {
      exists: Boolean(player),
      src: player?.currentSrc || player?.src || "",
      readyState: player?.readyState ?? -1,
      currentTime: player?.currentTime ?? 0,
      muted: player?.muted ?? null,
      volume: player?.volume ?? null,
      paused: player?.paused ?? null,
      error: player?.error?.message ?? null,
      clipId: document.querySelector("[data-active-clip]")?.getAttribute("data-active-clip") ?? null,
      audioTracks,
    };
  });
}

async function waitForReadyState(page: Page, min: number, timeoutMs: number) {
  await page.waitForFunction(
    (need) => {
      const player = document.querySelector<HTMLVideoElement>("video[data-feed-player]");
      return player != null && player.readyState >= need && !player.error;
    },
    min,
    { timeout: timeoutMs },
  );
}

async function waitForTimeAdvance(page: Page) {
  const start = await page.evaluate(() => {
    const player = document.querySelector<HTMLVideoElement>("video[data-feed-player]");
    return player?.currentTime ?? 0;
  });
  await page.waitForFunction(
    (prev) => {
      const player = document.querySelector<HTMLVideoElement>("video[data-feed-player]");
      return player != null && player.currentTime > prev + 0.05;
    },
    start,
    { timeout: 10000 },
  );
}

async function checkFeedPlayback(args: Args, watchPath: string) {
  await mkdir(args.shotDir, { recursive: true });
  const { browser, engine } = await launchBrowser();
  const mediaFailures: string[] = [];
  const consoleErrors: string[] = [];

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const base = new URL(args.baseUrl);
  if (process.env.VERIFY_FEED_COOKIE) {
    await context.addCookies(
      process.env.VERIFY_FEED_COOKIE.split(/;\s*/)
        .filter(Boolean)
        .map((c) => {
          const i = c.indexOf("=");
          return {
            name: c.slice(0, i),
            value: c.slice(i + 1),
            domain: base.hostname,
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "Lax" as const,
          };
        }),
    );
  }
  if (__bypass) {
    await context.route(
      (u) => u.host === base.host,
      (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-vercel-trusted-oidc-idp-token": __bypass,
          },
        }),
    );
  }
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/play\(\)|AbortError|not allowed|interrupted/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
  const onResponse = (response: Response) => {
    if (!isMediaUrl(response.url())) return;
    if (response.status() >= 400) {
      mediaFailures.push(`${response.status()} ${response.url()}`);
    }
  };
  page.on("response", onResponse);
  page.on("requestfailed", (request) => {
    if (!isMediaUrl(request.url())) return;
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    mediaFailures.push(`failed ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });

  try {
    await page.goto(`${args.baseUrl}${watchPath}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForLoadState("load", { timeout: 30000 }).catch(() => undefined);
    await page.waitForSelector(".feed-scroller", { timeout: 15000 });
    await page.waitForSelector("video[data-feed-player]", {
      state: "attached",
      timeout: 15000,
    });

    const slideCount = await page.locator(".feed-slide").count();
    if (slideCount < 5) {
      throw new Error(
        `need at least 5 clips on the watch page, found ${slideCount}. Pass --watch-url for a longer session.`,
      );
    }

    await waitForReadyState(page, 3, 20000);
    await waitForTimeAdvance(page);
    const playing = await playerSnapshot(page);
    if (playing.readyState < 3) {
      throw new Error(`active video readyState ${playing.readyState}, want >= 3`);
    }
    console.log(`ok first clip playing (${engine})`, playing.clipId, playing.readyState);

    await page.locator("[data-sound-control]").click();
    await page.waitForFunction(() => {
      const player = document.querySelector<HTMLVideoElement>("video[data-feed-player]");
      return player != null && player.muted === false;
    }, null, { timeout: 10000 });
    const unmuted = await playerSnapshot(page);
    if (unmuted.muted !== false) {
      throw new Error(`unmute left player muted: ${JSON.stringify(unmuted)}`);
    }
    if ((unmuted.volume ?? 0) <= 0) {
      throw new Error(`volume was ${unmuted.volume} after unmute`);
    }
    if (unmuted.audioTracks === 0) {
      throw new Error("video has no audio tracks after unmute");
    }
    console.log("ok unmuted", {
      volume: unmuted.volume,
      audioTracks: unmuted.audioTracks,
    });

    let currentId = unmuted.clipId;
    for (let step = 1; step < 5; step += 1) {
      const before = currentId ?? (await playerSnapshot(page)).clipId;
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        (prev) =>
          document.querySelector("[data-active-clip]")?.getAttribute("data-active-clip") !==
          prev,
        before,
        { timeout: 15000 },
      );
      await waitForReadyState(page, 2, 15000);
      const next = await playerSnapshot(page);
      if (next.readyState < 2) {
        throw new Error(`clip ${step + 1} readyState ${next.readyState}, want >= 2`);
      }
      if (next.error) {
        throw new Error(`clip ${step + 1} media error: ${next.error}`);
      }
      currentId = next.clipId;
      console.log(`ok clip ${step + 1} loaded`, next.clipId, next.readyState);
    }

    if (mediaFailures.length > 0) {
      throw new Error(`media request failures:\n${mediaFailures.join("\n")}`);
    }
    const mediaConsole = consoleErrors.filter((text) =>
      /media|video|playback|demux|source|net::/i.test(text),
    );
    if (mediaConsole.length > 0) {
      throw new Error(`media console errors:\n${mediaConsole.join("\n")}`);
    }

    console.log("ok feed played 5 clips with sound and no media errors");
  } catch (error) {
    await page
      .screenshot({ path: `${args.shotDir}/lockdown-feed.png`, fullPage: true })
      .catch(() => undefined);
    throw error;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs();
  console.log("verify-lockdown", {
    baseUrl: args.baseUrl,
    cdnUrl: args.cdnUrl,
    skipFeed: args.skipFeed,
    expectUploadsUnlocked: args.expectUploadsUnlocked,
    expectPlaybackUnlocked: args.expectPlaybackUnlocked,
  });

  if (!args.expectUploadsUnlocked) {
    await checkUnsignedUploads(args.cdnUrl, args.originalKey);
  } else {
    console.log("skip unsigned uploads/* (VERIFY_EXPECT_UNLOCKED=1)");
  }

  const watchPath = await discoverWatchPath(args.baseUrl, args.watchUrl);
  const { html, clipId } = await checkHtmlAndApis(args.baseUrl, watchPath);
  const playbackKeys = extractPlaybackKeys(html);
  const playbackKey = args.playbackKey || playbackKeys[0];
  if (!playbackKey) {
    throw new Error(
      "watch HTML had no playback/.../playback.mp4 key. Pass --playback-key or VERIFY_PLAYBACK_KEY",
    );
  }
  if (args.expectPlaybackUnlocked) {
    await checkPlaybackStillPublic(args.cdnUrl, playbackKey);
  } else {
    await checkUnsignedPlayback(args.cdnUrl, playbackKey);
  }
  await checkPostersStillPublic(args.cdnUrl, extractPosterKeys(html)[0] ?? null);
  await checkDownloadAuth(args.baseUrl, clipId, args.freeCookie, args.proCookie);

  if (args.skipFeed) {
    console.log("skip feed Playwright (--skip-feed)");
  } else {
    await checkFeedPlayback(args, watchPath);
  }

  console.log("PASS: phase 2 playback lockdown checks");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
