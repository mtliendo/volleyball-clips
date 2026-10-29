import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/admin";
import { appBaseUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { ensureAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

async function loadPortalContext() {
  const { session, error } = await requireUserApi();
  if (error) return { ok: false as const, error };
  if (!isStripeConfigured()) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "Billing is not configured" }, { status: 503 }),
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "Billing is not configured" }, { status: 503 }),
    };
  }

  const appUser = await ensureAppUser(session.user);
  if (!appUser?.stripeCustomerId) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "No billing account yet" }, { status: 400 }),
    };
  }

  return { ok: true as const, stripe, customerId: appUser.stripeCustomerId };
}

export async function GET() {
  const { session, error } = await requireUserApi();
  if (error) return error;
  getStripe();
  if (session) {
    await ensureAppUser(session.user);
  }
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST() {
  const context = await loadPortalContext();
  if (!context.ok) return context.error;

  const portal = await context.stripe.billingPortal.sessions.create({
    customer: context.customerId,
    return_url: `${appBaseUrl()}/pricing`,
    ...(process.env.STRIPE_PORTAL_CONFIG_ID
      ? { configuration: process.env.STRIPE_PORTAL_CONFIG_ID }
      : {}),
  });

  return NextResponse.json({ url: portal.url });
}
