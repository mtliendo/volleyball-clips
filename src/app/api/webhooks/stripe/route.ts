import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isDatabaseConfigured, isStripeWebhookConfigured } from "@/lib/env";
import { getStripe, subscriptionPeriodEnd } from "@/lib/stripe";
import { getUserById, getUserByStripeCustomerId } from "@/lib/users";

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") {
    return parentSub;
  }
  if (parentSub && typeof parentSub === "object" && "id" in parentSub) {
    return parentSub.id;
  }
  const legacy = invoice as Stripe.Invoice & { subscription?: string | { id: string } | null };
  if (typeof legacy.subscription === "string") {
    return legacy.subscription;
  }
  if (legacy.subscription && typeof legacy.subscription === "object") {
    return legacy.subscription.id;
  }
  return null;
}

async function applySubscription(
  subscription: Stripe.Subscription,
  customerId: string | null,
) {
  const metadataUserId =
    typeof subscription.metadata?.userId === "string" ? subscription.metadata.userId : null;
  const user =
    (metadataUserId ? await getUserById(metadataUserId) : null) ??
    (customerId ? await getUserByStripeCustomerId(customerId) : null);

  if (!user) {
    return;
  }

  await getDb()
    .update(users)
    .set({
      stripeCustomerId: customerId ?? user.stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId =
        (typeof session.metadata?.userId === "string" && session.metadata.userId) ||
        session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      if (userId && customerId) {
        await getDb()
          .update(users)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }
      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await applySubscription(subscription, customerId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      await applySubscription(subscription, customerId);
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscription(subscription, customerId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
