import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton, PortalButton } from "@/components/billing-buttons";
import { TrackAnchor } from "@/components/track-click";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { trackServerEvent } from "@/lib/analytics-server";
import { authLoginHref } from "@/lib/auth-urls";
import { getViewer } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Watch for free. Pay if you want the original files from the glasses.",
  openGraph: {
    title: "Pricing",
    description: "Watch for free. Pay if you want the original files from the glasses.",
    url: "https://vbpov.com/pricing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing",
    description: "Watch for free. Pay if you want the original files from the glasses.",
  },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  if (checkout === "success") {
    trackServerEvent(ANALYTICS_EVENTS.checkoutSuccess);
  }
  const viewer = await getViewer();

  return (
    <div className="container space-y-10 py-10">
      <header className="space-y-3">
        <h1 className="display text-display">Watch free. Keep the good ones.</h1>
        <p className="lead">
          Watch for free. Pay if you want the original files from the glasses.
        </p>
        {checkout === "success" ? (
          <p className="chip-spark">Pro is on through this billing period.</p>
        ) : null}
      </header>

      <ol className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <li className="well flex flex-col gap-4 p-5">
          <p className="meta">Guest</p>
          <h2 className="display text-section">$0</h2>
          <p>Seven clips a day, then we ask you to sign up. Pins count.</p>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>Watch in the feed at 1080p</li>
            <li>No favorites</li>
            <li>No downloads</li>
          </ul>
        </li>
        <li className="well flex flex-col gap-4 p-5">
          <p className="meta">Free account</p>
          <h2 className="display text-section">$0</h2>
          <p>Watch as much as you want. Heart clips. Download three a week in 1080p.</p>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>A favorites page</li>
            <li>3 downloads each rolling week</li>
            <li>The 1080p copy, not the original</li>
          </ul>
          {viewer.signedIn ? (
            <p className="meta">You are signed in.</p>
          ) : (
            <TrackAnchor
              href={authLoginHref({ returnTo: "/pricing", signup: true })}
              event={ANALYTICS_EVENTS.signupClick}
              className="btn btn-primary mt-auto"
            >
              Make a free account
            </TrackAnchor>
          )}
        </li>
        <li className="flex flex-col gap-4 rounded-card bg-accent p-6 text-accent-ink lg:min-h-full">
          <p className="text-sm">Pro</p>
          <h2 className="display text-section">$5 / month</h2>
          <p>Download as many as you want, including the original glasses files.</p>
          <div className="rounded-card bg-paper p-4 text-ink">
            <p className="display text-2xl">~1400 × 1900 at 120 fps</p>
            <p className="meta mt-2">
              The file the glasses shot. The 1080p copy is just for watching.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            <li>Unlimited original downloads</li>
            <li>If you cancel, it stays on until the period ends</li>
            <li>Change your card in Stripe</li>
          </ul>
          <div className="mt-auto">
            <CheckoutButton
              signedIn={viewer.signedIn}
              stripeReady={viewer.stripeReady}
              alreadyPro={viewer.isPro && !viewer.isAdmin}
            />
          </div>
        </li>
      </ol>

      {viewer.isPro ? (
        <div className="max-w-sm">
          <PortalButton />
        </div>
      ) : null}

      {viewer.canDownload && viewer.downloadsRemaining !== null ? (
        <p className="meta">{viewer.downloadsRemaining} free downloads left this week</p>
      ) : null}

      <p className="meta">
        Questions about limits, takedowns, or canceling?{" "}
        <Link href="/faq" className="text-ink underline underline-offset-4">
          Read the FAQ
        </Link>
        .
      </p>
    </div>
  );
}
