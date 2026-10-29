"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AuthLoginAnchor } from "@/components/auth-login-anchor";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

export function GuestAuthNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <>
      <AuthLoginAnchor
        returnTo={returnTo}
        event={ANALYTICS_EVENTS.signInClick}
        className="text-muted hover:text-ink"
      >
        Sign in
      </AuthLoginAnchor>
      <AuthLoginAnchor
        returnTo={returnTo}
        signup
        event={ANALYTICS_EVENTS.signupClick}
        className="btn btn-primary !min-h-9 !px-3"
      >
        Create account
      </AuthLoginAnchor>
    </>
  );
}
