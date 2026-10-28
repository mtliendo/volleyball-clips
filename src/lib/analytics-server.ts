import "server-only";

import { track } from "@vercel/analytics/server";
import type { AnalyticsEvent, AnalyticsProps } from "./analytics-events";

/** Fire-and-forget server track. Safe on Hobby; a failed call is ignored. */
export function trackServerEvent(name: AnalyticsEvent | string, data?: AnalyticsProps) {
  try {
    void track(name, data).catch(() => {
      /* Hobby / missing insights endpoint */
    });
  } catch {
    /* analytics must never break the product */
  }
}
