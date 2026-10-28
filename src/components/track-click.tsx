"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { trackEvent, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";

export function TrackLink({
  href,
  event,
  data,
  children,
  ...props
}: {
  href: string;
  event: AnalyticsEvent;
  data?: AnalyticsProps;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href" | "onClick">) {
  return (
    <Link
      href={href}
      onClick={() => {
        trackEvent(event, data);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

export function TrackAnchor({
  href,
  event,
  data,
  children,
  ...props
}: {
  href: string;
  event: AnalyticsEvent;
  data?: AnalyticsProps;
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "onClick">) {
  return (
    <a
      href={href}
      onClick={() => {
        trackEvent(event, data);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
