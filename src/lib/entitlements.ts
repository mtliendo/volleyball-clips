import "server-only";

import { getSession } from "./admin";
import { ANON_WATCH_LIMIT, FREE_DOWNLOADS_PER_WEEK } from "./db/schema";
import { isAuth0Configured, isStripeConfigured } from "./env";
import { countDownloadsThisWeek } from "./limits";
import { isAdmin } from "./roles";
import { ensureAppUser, type AppUser } from "./users";

export type Viewer = {
  signedIn: boolean;
  isAdmin: boolean;
  isPro: boolean;
  watchUnlimited: boolean;
  canFavorite: boolean;
  canDownload: boolean;
  downloadsRemaining: number | null;
  stripeReady: boolean;
  authReady: boolean;
  email: string | null;
  name: string | null;
  appUserId: string | null;
};

export function hasProAccess(user: Pick<AppUser, "subscriptionStatus" | "currentPeriodEnd"> | null) {
  if (!user?.subscriptionStatus) {
    return false;
  }

  const status = user.subscriptionStatus;
  if (status === "active" || status === "trialing" || status === "past_due") {
    return true;
  }

  if (status === "canceled" && user.currentPeriodEnd && user.currentPeriodEnd > new Date()) {
    return true;
  }

  return false;
}

export async function getViewer(): Promise<Viewer> {
  const session = await getSession();
  const admin = isAdmin(session?.user);
  const appUser = session ? await ensureAppUser(session.user) : null;
  const pro = admin || hasProAccess(appUser);
  const used = appUser && !pro ? await countDownloadsThisWeek(appUser.id) : 0;

  return {
    signedIn: Boolean(session),
    isAdmin: admin,
    isPro: pro,
    watchUnlimited: Boolean(session) || admin,
    canFavorite: Boolean(appUser),
    canDownload: Boolean(appUser),
    downloadsRemaining: pro || admin ? null : Math.max(0, FREE_DOWNLOADS_PER_WEEK - used),
    stripeReady: isStripeConfigured(),
    authReady: isAuth0Configured(),
    email: appUser?.email ?? session?.user.email ?? null,
    name: appUser?.name ?? session?.user.name ?? null,
    appUserId: appUser?.id ?? null,
  };
}

export { ANON_WATCH_LIMIT, FREE_DOWNLOADS_PER_WEEK };
