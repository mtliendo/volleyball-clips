import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/admin";
import { appBaseUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { ensureAppUser } from "@/lib/users";

export async function POST() {
  const { session, error } = await requireUserApi();
  if (error) return error;
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const appUser = await ensureAppUser(session.user);
  if (!appUser?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: appUser.stripeCustomerId,
    return_url: `${appBaseUrl()}/pricing`,
    ...(process.env.STRIPE_PORTAL_CONFIG_ID
      ? { configuration: process.env.STRIPE_PORTAL_CONFIG_ID }
      : {}),
  });

  return NextResponse.json({ url: portal.url });
}
