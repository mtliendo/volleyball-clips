import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckoutButton, PortalButton } from "@/components/billing-buttons";
import { isVerifyHarnessEnabled } from "@/lib/verify-feed";

export const dynamic = "force-dynamic";

export default async function VerifyCheckoutPendingPage() {
  await connection();
  if (!isVerifyHarnessEnabled()) {
    notFound();
  }

  return (
    <div className="container space-y-8 py-10" data-verify-checkout-pending="">
      <header className="space-y-2">
        <h1 className="display text-display-s">Checkout pending</h1>
        <p className="lead">Verify harness for the billing preparing state.</p>
      </header>

      <section className="well space-y-4 p-5" data-verify-billing-surface="checkout">
        <p className="meta">Upgrade / checkout</p>
        <CheckoutButton signedIn stripeReady alreadyPro={false} />
      </section>

      <section className="well space-y-4 p-5" data-verify-billing-surface="portal">
        <p className="meta">Manage billing / portal</p>
        <PortalButton label="Manage billing" />
      </section>
    </div>
  );
}
