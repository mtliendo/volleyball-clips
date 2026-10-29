"use client";

import type { ComponentProps, ReactNode } from "react";
import { trackEvent, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";
import { authLoginHref } from "@/lib/auth-urls";

/**
 * Full-document navigation to Auth0. Next.js must not treat `/auth/login` as an
 * in-app page — that is what rendered the "Not on the court" 404.
 */
export function AuthLoginAnchor({
  returnTo,
  signup,
  event,
  data,
  children,
  ...props
}: {
  returnTo?: string;
  signup?: boolean;
  event: AnalyticsEvent;
  data?: AnalyticsProps;
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "onClick">) {
  const href = authLoginHref({ returnTo, signup });

  return (
    <a
      href={href}
      onClick={(click) => {
        trackEvent(event, data);
        click.preventDefault();
        window.location.assign(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
