import Link from "next/link";
import { GuestAuthNav } from "@/components/guest-auth-nav";
import { TrackLink } from "@/components/track-click";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { getSession, isAdmin } from "@/lib/admin";
import { isAuth0Configured } from "@/lib/env";

export async function SiteHeader() {
  const session = await getSession();
  const authReady = isAuth0Configured();
  const admin = isAdmin(session);

  return (
    <header className="sticky top-0 z-(--z-sticky-nav) border-b border-rule bg-paper/88 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between gap-3">
        <Link href="/" className="font-outlier text-xl leading-none">
          VB POV
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <TrackLink href="/pricing" event={ANALYTICS_EVENTS.goProClick} className="text-muted hover:text-ink">
            Pricing
          </TrackLink>
          {session ? (
            <>
              <Link href="/favorites" className="text-muted hover:text-ink">
                Favorites
              </Link>
              {admin ? (
                <Link href="/admin" className="text-muted hover:text-ink">
                  Admin
                </Link>
              ) : null}
              <a href="/auth/logout" className="text-muted hover:text-ink">
                Sign out
              </a>
            </>
          ) : authReady ? (
            <GuestAuthNav />
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteHeaderFallback() {
  return <header className="sticky top-0 z-(--z-sticky-nav) h-14 border-b border-rule bg-paper" />;
}
