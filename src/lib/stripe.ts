import "server-only";

import Stripe from "stripe";
import { isStripeConfigured } from "./env";

let client: Stripe | null | undefined;

export function getStripe() {
  if (!isStripeConfigured()) {
    return null;
  }
  if (client !== undefined) {
    return client;
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    client = null;
    return null;
  }
  client = new Stripe(key);
  return client;
}

export function stripePriceId() {
  return process.env.STRIPE_PRICE_ID ?? "";
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const unix =
    "current_period_end" in subscription && typeof subscription.current_period_end === "number"
      ? subscription.current_period_end
      : subscription.items?.data?.[0] &&
          "current_period_end" in subscription.items.data[0] &&
          typeof subscription.items.data[0].current_period_end === "number"
        ? subscription.items.data[0].current_period_end
        : null;

  return unix ? new Date(unix * 1000) : null;
}
