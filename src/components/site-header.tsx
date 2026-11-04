"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { GuestAuthNav } from "@/components/guest-auth-nav";
import { TrackLink } from "@/components/track-click";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { isAdmin } from "@/lib/roles";

export function SiteHeader({ authReady }: { authReady: boolean }) {
  const { user } = useUser();
  const signedIn = Boolean(user);
  const admin = isAdmin(user);

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
          {signedIn ? (
            <>
              <Link href="/favorites" className="text-muted hover:text-ink">
                Favorites
              </Link>
              {admin ? (
                <Link href="/admin" className="text-muted hover:text-ink">
                  Admin
                </Link>
              ) : null}
              {/* Auth0 logout is a route handler, not an App Router page. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/auth/logout" className="text-muted hover:text-ink">
                Sign out
              </a>
            </>
          ) : authReady ? (
            <Suspense fallback={null}>
              <GuestAuthNav />
            </Suspense>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteHeaderFallback() {
  return <header className="sticky top-0 z-(--z-sticky-nav) h-14 border-b border-rule bg-paper" />;
}
