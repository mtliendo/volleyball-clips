/**
 * Headless check: logged-out download/favorite open Auth0, not the 404 page.
 *
 *   VERIFY_FEED_HARNESS=1 pnpm exec tsx scripts/verify-guest-auth.ts --base-url http://127.0.0.1:3000
 *
 * Uses waitUntil: load / domcontentloaded — never networkidle.
 */
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

const AUTH0_HOST = "vb-pov.us.auth0.com";

async function expectAuth0Redirect(url: string, label: string) {
  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  if (response.status < 300 || response.status >= 400) {
    throw new Error(`${label} returned ${response.status}, expected a redirect`);
  }
  let host = "";
  try {
    host = new URL(location, url).host;
  } catch {
    throw new Error(`${label} Location was not a URL: ${location}`);
  }
  if (host !== AUTH0_HOST) {
    throw new Error(`${label} redirected to ${location}, expected ${AUTH0_HOST}`);
  }
  console.log(`ok ${label} -> ${host}`);
}

async function clickToAuth0(
  page: import("playwright").Page,
  selector: string,
  label: string,
) {
  await page.goto(`${baseUrl}/dev/guest-auth`, { waitUntil: "domcontentloaded" });
  const control = page.locator(selector).first();
  await control.waitFor({ state: "visible", timeout: 15000 });
  const href = await control.getAttribute("href");
  if (!href?.startsWith("/auth/login")) {
    throw new Error(`${label} href was "${href}", expected /auth/login`);
  }
  if (!href.includes("returnTo=")) {
    throw new Error(`${label} href missing returnTo: ${href}`);
  }
  if (!href.includes("screen_hint=signup")) {
    throw new Error(`${label} href missing screen_hint=signup: ${href}`);
  }

  await Promise.all([
    page.waitForURL((dest) => dest.hostname === AUTH0_HOST, { timeout: 20000 }),
    control.click(),
  ]);

  if (page.url().includes("not-found") || (await page.locator("h1").innerText()).includes("Not on the court")) {
    throw new Error(`${label} landed on the app 404 page`);
  }
  console.log(`ok click ${label} -> ${new URL(page.url()).host}`);
}

async function main() {
  const harness = await fetch(`${baseUrl}/dev/guest-auth`, { redirect: "manual" });
  if (harness.status >= 400) {
    throw new Error(
      `harness missing (${harness.status}). Start the app with VERIFY_FEED_HARNESS=1`,
    );
  }

  await expectAuth0Redirect(
    `${baseUrl}/auth/login?returnTo=${encodeURIComponent("/dev/guest-auth")}&screen_hint=signup`,
    "GET /auth/login",
  );
  await expectAuth0Redirect(
    `${baseUrl}/auth/login?returnTo=${encodeURIComponent("/favorites")}`,
    "GET /auth/login (favorites returnTo)",
  );

  const legacy = await fetch(`${baseUrl}/api/auth/login?returnTo=%2F`, { redirect: "manual" });
  const legacyLocation = legacy.headers.get("location") ?? "";
  if (legacy.status !== 307 && legacy.status !== 308) {
    throw new Error(`legacy /api/auth/login returned ${legacy.status}, expected 307`);
  }
  if (!legacyLocation.includes("/auth/login")) {
    throw new Error(`legacy /api/auth/login redirected to ${legacyLocation}`);
  }
  console.log("ok GET /api/auth/login -> /auth/login");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  try {
    await clickToAuth0(
      page,
      '[data-verify-guest-surface="compact"] [data-download-control]',
      "download",
    );
    await clickToAuth0(
      page,
      '[data-verify-guest-surface="compact"] [data-favorite-control]',
      "favorite",
    );
  } finally {
    await browser.close();
  }

  console.log("PASS: logged-out download and favorite open Auth0, not 404");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
