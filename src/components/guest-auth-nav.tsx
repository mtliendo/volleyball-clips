"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { authLoginHref } from "@/lib/auth-urls";
import { TrackAnchor } from "@/components/track-click";

export function GuestAuthNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <>
      <TrackAnchor
        href={authLoginHref({ returnTo })}
        event={ANALYTICS_EVENTS.signInClick}
        className="text-muted hover:text-ink"
      >
        Sign in
      </TrackAnchor>
      <TrackAnchor
        href={authLoginHref({ returnTo, signup: true })}
        event={ANALYTICS_EVENTS.signupClick}
        className="btn btn-primary !min-h-9 !px-3"
      >
        Create account
      </TrackAnchor>
    </>
  );
}
