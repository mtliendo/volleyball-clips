import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hasProAccess } from "@/lib/entitlements";
import { appBaseUrl, isStripeConfigured } from "@/lib/env";
import { getStripe, stripePriceId } from "@/lib/stripe";
import { ensureAppUser } from "@/lib/users";
import { eq } from "drizzle-orm";

export async function POST() {
  const { session, error } = await requireUserApi();
  if (error) return error;
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const price = stripePriceId();
  if (!stripe || !price) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const appUser = await ensureAppUser(session.user);
  if (!appUser) {
    return NextResponse.json({ error: "Could not save account" }, { status: 503 });
  }

  if (hasProAccess(appUser)) {
    return NextResponse.json({ error: "Already subscribed" }, { status: 409 });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${appBaseUrl()}/pricing?checkout=success`,
    cancel_url: `${appBaseUrl()}/pricing?checkout=cancel`,
    client_reference_id: appUser.id,
    customer: appUser.stripeCustomerId ?? undefined,
    customer_email: appUser.stripeCustomerId ? undefined : appUser.email ?? undefined,
    metadata: {
      userId: appUser.id,
      auth0Sub: appUser.auth0Sub,
    },
    subscription_data: {
      metadata: {
        userId: appUser.id,
        auth0Sub: appUser.auth0Sub,
      },
    },
  });

  if (checkout.customer && typeof checkout.customer === "string" && !appUser.stripeCustomerId) {
    await getDb()
      .update(users)
      .set({ stripeCustomerId: checkout.customer, updatedAt: new Date() })
      .where(eq(users.id, appUser.id));
  }

  if (!checkout.url) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }

  return NextResponse.json({ url: checkout.url });
}
