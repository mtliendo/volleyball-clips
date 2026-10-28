import Link from "next/link";
import { TrackLink } from "@/components/track-click";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

export function SiteFooter() {
  return (
    <footer className="rule-top mt-16">
      <div className="container flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-outlier text-2xl">VB POV</p>
          <p className="meta mt-2 max-w-xs">
            Volleyball clips from Focus. Pick a night and watch.
          </p>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            Nights
          </Link>
          <TrackLink href="/pricing" event={ANALYTICS_EVENTS.goProClick} className="text-muted hover:text-ink">
            Pricing
          </TrackLink>
          <Link href="/favorites" className="text-muted hover:text-ink">
            Favorites
          </Link>
        </nav>
      </div>
    </footer>
  );
}
