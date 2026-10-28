import { CheckoutButton, PortalButton } from "@/components/billing-buttons";
import { authLoginHref } from "@/lib/auth-urls";
import { getViewer } from "@/lib/entitlements";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const viewer = await getViewer();

  return (
    <div className="container space-y-10 py-10">
      <header className="space-y-3">
        <h1 className="display text-display">Watch free. Keep the original.</h1>
        <p className="lead">
          Guests get seven clips a day. An account saves favorites. Pro downloads the 120 fps file the glasses shot.
        </p>
        {checkout === "success" ? (
          <p className="chip-spark">Pro is on for this period.</p>
        ) : null}
      </header>

      <ol className="grid gap-4 lg:grid-cols-3">
        <li className="well flex flex-col gap-4 p-5">
          <p className="meta">Guest</p>
          <h2 className="display text-section">$0</h2>
          <p>Seven clips a day, then a sign-up wall. Pins count.</p>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>1080p playback in the feed</li>
            <li>No favorites</li>
            <li>No downloads</li>
          </ul>
        </li>
        <li className="well flex flex-col gap-4 p-5">
          <p className="meta">Free account</p>
          <h2 className="display text-section">$0</h2>
          <p>Unlimited watching, hearts, and three 1080p downloads a week.</p>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>Favorites page</li>
            <li>3 downloads each rolling week</li>
            <li>Playback copy, not the original</li>
          </ul>
          {viewer.signedIn ? (
            <p className="meta">You are signed in.</p>
          ) : (
            <a href={authLoginHref({ returnTo: "/pricing", signup: true })} className="btn btn-primary mt-auto">
              Create account
            </a>
          )}
        </li>
        <li className="flex flex-col gap-4 rounded-card bg-accent p-5 text-accent-ink">
          <p className="text-sm">Pro</p>
          <h2 className="display text-section">$5 / month</h2>
          <p>Unlimited downloads of the full-quality original.</p>
          <div className="rounded-card bg-paper p-4 text-ink">
            <p className="display text-2xl">~1400 × 1900 at 120 fps</p>
            <p className="meta mt-2">
              The glasses file, not the 1080p copy. That is the reason to pay.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            <li>Every original, every week</li>
            <li>Access lasts through the paid period after cancel</li>
            <li>Card updates in the Stripe portal</li>
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
    </div>
  );
}
