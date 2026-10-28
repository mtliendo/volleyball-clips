export const ANALYTICS_EVENTS = {
  clipView: "clip_view",
  favorite: "favorite",
  downloadSuccess: "download_success",
  downloadLimitHit: "download_limit_hit",
  watchLimitHit: "watch_limit_hit",
  signupClick: "signup_click",
  signInClick: "sign_in_click",
  goProClick: "go_pro_click",
  checkoutStarted: "checkout_started",
  checkoutSuccess: "checkout_success",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;
