import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="rule-top mt-16">
      <div className="container flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-outlier text-2xl">VB POV</p>
          <p className="meta mt-2 max-w-xs">
            Meta-glasses volleyball from Focus. Nights, sessions, then the feed.
          </p>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            Nights
          </Link>
          <Link href="/pricing" className="text-muted hover:text-ink">
            Pricing
          </Link>
          <Link href="/favorites" className="text-muted hover:text-ink">
            Favorites
          </Link>
        </nav>
      </div>
    </footer>
  );
}
