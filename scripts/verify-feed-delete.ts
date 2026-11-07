/**
 * Headless check: admin delete control on the viewer.
 *
 *   VERIFY_FEED_HARNESS=1 pnpm exec tsx scripts/verify-feed-delete.ts --base-url http://127.0.0.1:3000
 *
 * Screenshots use waitUntil: load / domcontentloaded — never networkidle.
 * Destructive calls are intercepted; no production clips are deleted.
 */
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

// Keep in sync with src/lib/verify-feed.ts — do not import that file (server-only).
const VERIFY_CLIP_IDS = [
  "22222222-2222-4222-8222-222222222221",
  "22222222-2222-4222-8222-222222222222",
  "22222222-2222-4222-8222-222222222223",
] as const;

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
const shotDir = process.env.VERIFY_SHOT_DIR || "/opt/cursor/artifacts/screenshots";

function isClipDelete(url: string, method: string) {
  if (method !== "DELETE") return false;
  try {
    return /\/api\/admin\/clips\/[^/]+$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function feedState(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-active-clip]");
    const confirm = document.querySelector("[data-delete-confirm]");
    return {
      clipId: root?.getAttribute("data-active-clip") ?? null,
      deleteControl: Boolean(document.querySelector("[data-delete-control]")),
      dialog: Boolean(document.querySelector("[data-delete-dialog]")),
      dialogClip: document.querySelector("[data-delete-dialog]")?.getAttribute("data-delete-clip") ?? null,
      identity: document.querySelector("[data-delete-identity]")?.textContent?.trim() ?? null,
      details: document.querySelector("[data-delete-details]")?.textContent?.trim() ?? null,
      error: document.querySelector("[data-delete-error]")?.textContent?.trim() ?? null,
      confirmDisabled: confirm instanceof HTMLButtonElement ? confirm.disabled : null,
      confirmLabel: confirm?.textContent?.trim() ?? null,
      empty: Boolean(document.querySelector("[data-feed-empty]")),
      url: `${window.location.pathname}${window.location.search}`,
    };
  });
}

async function openAdminFeed(page: Page) {
  const response = await page.goto(`${baseUrl}/dev/feed-keys?as=admin`, {
    waitUntil: "load",
  });
  if (!response || response.status() >= 400) {
    throw new Error(
      `harness missing (${response?.status() ?? "no response"}). Start the app with VERIFY_FEED_HARNESS=1`,
    );
  }
  await page.waitForSelector("[data-active-clip]", { timeout: 15000 });
  await page.waitForSelector("[data-delete-control]", { timeout: 15000 });
  await page.waitForFunction(
    () => window.location.pathname.includes("/watch/"),
    { timeout: 15000 },
  );
}

async function screenshotControlAndDialog(
  page: Page,
  names: { control: string; confirm: string },
) {
  const deleteControl = page.locator("[data-delete-control]");
  await deleteControl.waitFor({ timeout: 8000 });
  await page.evaluate(() => {
    document.querySelectorAll(".verify-url").forEach((node) => {
      (node as HTMLElement).style.visibility = "hidden";
    });
  });
  await page.screenshot({ path: `${shotDir}/${names.control}`, fullPage: false });
  await deleteControl.click();
  await page.waitForSelector("[data-delete-dialog]", { timeout: 8000 });
  const state = await feedState(page);
  if (!state.identity || !state.details) {
    throw new Error(`confirmation did not identify the clip: ${JSON.stringify(state)}`);
  }
  if (!state.details.includes("Spike") || !state.details.includes("0:08")) {
    throw new Error(`confirmation missing clip details: ${JSON.stringify(state)}`);
  }
  await page.screenshot({ path: `${shotDir}/${names.confirm}`, fullPage: false });
}

async function main() {
  await mkdir(shotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const desktop = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    const guestPage = await mobile.newPage();
    const guest = await guestPage.goto(`${baseUrl}/dev/feed-keys?as=guest`, {
      waitUntil: "load",
    });
    if (!guest || guest.status() >= 400) {
      throw new Error("guest harness missing");
    }
    await guestPage.waitForSelector("[data-active-clip]", { timeout: 15000 });
    if ((await guestPage.locator("[data-delete-control]").count()) !== 0) {
      throw new Error("guest saw the admin delete control");
    }
    if ((await guestPage.locator("[data-delete-from-sheet]").count()) !== 0) {
      throw new Error("guest saw delete in the tag sheet");
    }
    console.log("ok guest hidden");

    const userPage = await mobile.newPage();
    await userPage.goto(`${baseUrl}/dev/feed-keys?as=user`, { waitUntil: "load" });
    await userPage.waitForSelector("[data-active-clip]", { timeout: 15000 });
    if ((await userPage.locator("[data-delete-control]").count()) !== 0) {
      throw new Error("signed-in non-admin saw the admin delete control");
    }
    console.log("ok signed-in non-admin hidden");

    const unauth = await guestPage.request.delete(
      `${baseUrl}/api/admin/clips/${VERIFY_CLIP_IDS[0]}`,
    );
    if (unauth.status() !== 401 && unauth.status() !== 403) {
      throw new Error(`anonymous DELETE should reject, got ${unauth.status()}`);
    }
    console.log("ok unauthorized API rejected", unauth.status());

    const mobileAdmin = await mobile.newPage();
    const desktopAdmin = await desktop.newPage();
    const deletes: { clipId: string; count: number }[] = [];
    let deleteMode: "ok" | "fail" | "forbidden" | "slow" = "ok";

    for (const page of [mobileAdmin, desktopAdmin]) {
      await page.route("**/api/admin/clips/**", async (route) => {
        const request = route.request();
        if (!isClipDelete(request.url(), request.method())) {
          await route.continue();
          return;
        }
        const clipId = request.url().split("/").filter(Boolean).at(-1) ?? "";
        const current = deletes.find((item) => item.clipId === clipId);
        if (current) current.count += 1;
        else deletes.push({ clipId, count: 1 });

        if (deleteMode === "slow") {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        if (deleteMode === "fail") {
          await route.fulfill({
            status: 502,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Could not delete all S3 objects. Database rows were left unchanged.",
            }),
          });
          return;
        }
        if (deleteMode === "forbidden") {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ error: "Forbidden" }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      });
    }

    await openAdminFeed(mobileAdmin);
    await screenshotControlAndDialog(mobileAdmin, {
      control: "admin-feed-delete-mobile.png",
      confirm: "admin-feed-delete-confirm-mobile.png",
    });
    const beforeCancel = await feedState(mobileAdmin);
    await mobileAdmin.locator("[data-delete-cancel]").click();
    await mobileAdmin.waitForFunction(() => !document.querySelector("[data-delete-dialog]"));
    const afterCancel = await feedState(mobileAdmin);
    if (afterCancel.dialog) throw new Error("cancel left the confirmation open");
    if (afterCancel.clipId !== beforeCancel.clipId) {
      throw new Error("cancel changed the active clip");
    }
    if (afterCancel.empty) throw new Error("cancel emptied the feed");
    console.log("ok cancel leaves clip intact");

    deleteMode = "fail";
    await mobileAdmin.locator("[data-delete-control]").click();
    await mobileAdmin.waitForSelector("[data-delete-dialog]");
    await mobileAdmin.locator("[data-delete-confirm]").click();
    await mobileAdmin.waitForSelector("[data-delete-error]");
    const failed = await feedState(mobileAdmin);
    if (!failed.error?.includes("Database rows were left unchanged")) {
      throw new Error(`failure not visible: ${JSON.stringify(failed)}`);
    }
    if (failed.clipId !== VERIFY_CLIP_IDS[0]) {
      throw new Error("failed delete removed the clip");
    }
    if (failed.confirmDisabled) {
      throw new Error("failed delete left confirm disabled");
    }
    console.log("ok failure stays recoverable");

    deleteMode = "forbidden";
    await mobileAdmin.locator("[data-delete-confirm]").click();
    await mobileAdmin.waitForFunction(() => {
      return document.querySelector("[data-delete-error]")?.textContent?.includes("Forbidden");
    });
    const forbidden = await feedState(mobileAdmin);
    if (forbidden.clipId !== VERIFY_CLIP_IDS[0]) {
      throw new Error("forbidden delete removed the clip");
    }
    console.log("ok forbidden stays visible");

    await mobileAdmin.locator("[data-delete-cancel]").click();
    await mobileAdmin.waitForFunction(() => !document.querySelector("[data-delete-dialog]"));

    deleteMode = "slow";
    await mobileAdmin.locator("[data-delete-control]").click();
    await mobileAdmin.waitForSelector("[data-delete-dialog]");
    const confirm = mobileAdmin.locator("[data-delete-confirm]");
    await Promise.all([confirm.click(), confirm.click()]);
    await mobileAdmin.waitForFunction(
      (nextId) => document.querySelector("[data-active-clip]")?.getAttribute("data-active-clip") === nextId,
      VERIFY_CLIP_IDS[1],
    );
    const afterDelete = await feedState(mobileAdmin);
    if (afterDelete.clipId !== VERIFY_CLIP_IDS[1]) {
      throw new Error(`expected next clip, got ${JSON.stringify(afterDelete)}`);
    }
    if (!afterDelete.url.includes(`/watch/${VERIFY_CLIP_IDS[1]}`)) {
      throw new Error(`url did not move to next clip: ${afterDelete.url}`);
    }
    if (afterDelete.dialog) throw new Error("success left the confirmation open");
    const firstDeletes = deletes.find((item) => item.clipId === VERIFY_CLIP_IDS[0]);
    if (!firstDeletes || firstDeletes.count < 1) {
      throw new Error("success path did not call DELETE");
    }
    console.log("ok confirm removes clip and advances", afterDelete.clipId);

    deleteMode = "ok";
    await mobileAdmin.locator("[data-delete-control]").click();
    await mobileAdmin.locator("[data-delete-confirm]").click();
    await mobileAdmin.waitForFunction(
      (nextId) => document.querySelector("[data-active-clip]")?.getAttribute("data-active-clip") === nextId,
      VERIFY_CLIP_IDS[2],
    );
    await mobileAdmin.locator("[data-delete-control]").click();
    await mobileAdmin.locator("[data-delete-confirm]").click();
    await mobileAdmin.waitForSelector("[data-feed-empty]", { timeout: 8000 });
    const empty = await feedState(mobileAdmin);
    if (!empty.empty) throw new Error("last delete did not show fallback");
    if (empty.clipId) throw new Error("empty fallback still had an active clip");
    console.log("ok last clip shows empty fallback");

    await openAdminFeed(desktopAdmin);
    await screenshotControlAndDialog(desktopAdmin, {
      control: "admin-feed-delete-desktop.png",
      confirm: "admin-feed-delete-confirm-desktop.png",
    });
    await desktopAdmin.keyboard.press("Escape");
    await desktopAdmin.waitForFunction(() => !document.querySelector("[data-delete-dialog]"));
    const afterEscape = await feedState(desktopAdmin);
    if (afterEscape.dialog) throw new Error("Escape did not cancel");
    if (afterEscape.clipId !== VERIFY_CLIP_IDS[0]) {
      throw new Error("Escape deleted the clip");
    }
    console.log("ok desktop cancel via Escape");

    await desktopAdmin.locator("[data-pin-control]").click();
    await desktopAdmin.waitForSelector("[data-pin-sheet]");
    if ((await desktopAdmin.locator("[data-delete-from-sheet]").count()) !== 1) {
      throw new Error("admin tag sheet is missing delete");
    }
    await desktopAdmin.locator("[data-delete-from-sheet]").click();
    await desktopAdmin.waitForSelector("[data-delete-dialog]");
    console.log("ok delete from tag sheet");

    console.log(`PASS: admin watch delete (screenshots in ${shotDir})`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
