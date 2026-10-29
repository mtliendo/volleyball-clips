/**
 * Headless checks for /faq and the download preparing state.
 *
 *   pnpm exec tsx scripts/verify-faq-download.ts --base-url http://127.0.0.1:3000
 *
 * Screenshots use waitUntil: load — never networkidle.
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
const shotDir = process.env.VERIFY_SHOT_DIR || "/opt/cursor/artifacts";

async function main() {
  await mkdir(shotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  await page.goto(`${baseUrl}/faq`, { waitUntil: "load" });
  const title = await page.title();
  if (!title.includes("FAQ")) {
    throw new Error(`FAQ title was "${title}"`);
  }

  const footerFaq = page.locator("footer a[href='/faq']");
  if ((await footerFaq.count()) === 0) {
    throw new Error("Footer is missing the FAQ link");
  }

  const takedown = page.locator("details.faq-item").filter({
    hasText: "take it down",
  });
  await takedown.locator("summary").click();
  const mailto = takedown.locator('a[href="mailto:michael@focusotter.com"]');
  if ((await mailto.count()) !== 1) {
    throw new Error("Takedown answer is missing the mailto link");
  }

  const picked = page.locator("details.faq-item").filter({
    hasText: "How do you pick the clips",
  });
  await picked.locator("summary").click();
  const pickedCopy = (await picked.locator(".faq-answer").innerText()).toLowerCase();
  if (!pickedCopy.includes("fun for everyone") || !pickedCopy.includes("10 seconds")) {
    throw new Error("Clip picking answer is missing the required copy");
  }

  await page.screenshot({
    path: `${shotDir}/faq-mobile.png`,
    fullPage: true,
  });

  await page.goto(`${baseUrl}/pricing`, { waitUntil: "load" });
  const pricingFaq = page.locator("a[href='/faq']");
  if ((await pricingFaq.count()) === 0) {
    throw new Error("Pricing page is missing the FAQ link");
  }

  await page.route("**/api/clips/*/download**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    await route.abort();
  });

  await page.goto(`${baseUrl}/dev/download-pending`, { waitUntil: "load" });
  const original = page.locator('[data-verify-download-surface="feed"] [data-download-control]');
  await original.click();
  const pending = page.locator('[data-download-pending="true"]');
  await pending.first().waitFor({ state: "visible", timeout: 5000 });

  const busy = await pending.first().getAttribute("aria-busy");
  const disabled = await pending.first().isDisabled();
  const label = await pending.first().innerText();
  if (busy !== "true") {
    throw new Error(`aria-busy should be true, got ${busy}`);
  }
  if (!disabled) {
    throw new Error("Download button should be disabled while pending");
  }
  if (!label.includes("Preparing download")) {
    throw new Error(`Pending label was "${label}"`);
  }

  const live = page.locator('[aria-live="polite"]').filter({ hasText: "Preparing download" });
  if ((await live.count()) === 0) {
    throw new Error("Missing aria-live polite preparing announcement");
  }

  await page.screenshot({
    path: `${shotDir}/download-pending-mobile.png`,
    fullPage: true,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const pulse = page.locator(".download-preparing-label.keep-motion");
  if ((await pulse.count()) === 0) {
    throw new Error("Reduced motion should keep the preparing label");
  }

  await page.unroute("**/api/clips/*/download**");
  await page.route("**/api/stripe/checkout", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    await route.abort();
  });
  await page.route("**/api/stripe/portal", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    await route.abort();
  });

  await page.goto(`${baseUrl}/dev/checkout-pending`, { waitUntil: "load" });
  const checkout = page.locator('[data-verify-billing-surface="checkout"] [data-billing-control]');
  await checkout.click();
  const checkoutPending = page.locator('[data-billing-pending="true"]');
  await checkoutPending.first().waitFor({ state: "visible", timeout: 5000 });
  const checkoutBusy = await checkoutPending.first().getAttribute("aria-busy");
  const checkoutDisabled = await checkoutPending.first().isDisabled();
  const checkoutLabel = await checkoutPending.first().innerText();
  if (checkoutBusy !== "true") {
    throw new Error(`checkout aria-busy should be true, got ${checkoutBusy}`);
  }
  if (!checkoutDisabled) {
    throw new Error("Checkout button should be disabled while pending");
  }
  if (!checkoutLabel.includes("Opening checkout")) {
    throw new Error(`Checkout pending label was "${checkoutLabel}"`);
  }
  const checkoutLive = page.locator('[aria-live="polite"]').filter({ hasText: "Opening checkout" });
  if ((await checkoutLive.count()) === 0) {
    throw new Error("Missing aria-live polite checkout announcement");
  }

  await page.screenshot({
    path: `${shotDir}/checkout-pending-mobile.png`,
    fullPage: true,
  });

  await browser.close();
  console.log(`FAQ title: ${title}`);
  console.log(`Wrote ${shotDir}/faq-mobile.png`);
  console.log(`Wrote ${shotDir}/download-pending-mobile.png`);
  console.log(`Wrote ${shotDir}/checkout-pending-mobile.png`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
