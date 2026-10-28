import { track } from "@vercel/analytics";
import type { AnalyticsEvent, AnalyticsProps } from "./analytics-events";

export { ANALYTICS_EVENTS, type AnalyticsEvent, type AnalyticsProps } from "./analytics-events";

/** Fire-and-forget. Safe on Hobby: custom events are dropped, never thrown. */
export function trackEvent(name: AnalyticsEvent | string, data?: AnalyticsProps) {
  try {
    track(name, data);
  } catch {
    /* analytics must never break the product */
  }
}
