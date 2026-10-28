import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Set STRIPE_SECRET_KEY (test mode sk_test_...) first");
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("This script is for Stripe TEST keys only");
  }

  const stripe = new Stripe(key);
  const product = await stripe.products.create({
    name: "VB POV Pro",
    description:
      "Unlimited downloads of full-quality originals (~1400x1900 at 120 fps).",
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 500,
    recurring: { interval: "month" },
  });

  console.log("Created Stripe test product and price.");
  console.log(`STRIPE_PRICE_ID=${price.id}`);
  console.log(`Product: ${product.id}`);
  console.log("");
  console.log("Then create a webhook endpoint for /api/webhooks/stripe");
  console.log("listening to:");
  console.log("  checkout.session.completed");
  console.log("  customer.subscription.created");
  console.log("  customer.subscription.updated");
  console.log("  customer.subscription.deleted");
  console.log("  invoice.paid");
  console.log("  invoice.payment_failed");
  console.log("Copy the signing secret into STRIPE_WEBHOOK_SECRET.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
