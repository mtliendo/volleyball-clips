import type { Metadata } from "next";
import Link from "next/link";
import { FaqItem } from "@/components/faq-item";
import { dataDeletionPageMetadata } from "@/lib/share-metadata";

export const metadata: Metadata = dataDeletionPageMetadata();

export default function DataDeletionPage() {
  return (
    <div className="container space-y-8 py-10">
      <header className="space-y-3">
        <h1 className="display text-display">Delete your data</h1>
        <p className="lead">
          How to wipe your VB POV account, or ask me to take a clip down.
        </p>
      </header>

      <div className="faq-list">
        <FaqItem question="Delete your account" defaultOpen>
          <p>
            Email{" "}
            <a href="mailto:michael@focusotter.com?subject=Delete%20my%20VB%20POV%20account">
              michael@focusotter.com
            </a>{" "}
            from the address on your account. Use the subject &quot;Delete my
            VB POV account&quot;.
          </p>
        </FaqItem>

        <FaqItem question="What I delete" defaultOpen>
          <p>
            Your Auth0 account, your row in my database, favorites, download
            records, and I cancel the Stripe customer if you have one. I do
            this within 30 days.
          </p>
        </FaqItem>

        <FaqItem question="If you signed in with Facebook" defaultOpen>
          <p>
            After I delete the account here, you can also drop the app on
            Facebook: Settings &amp; privacy, then Settings, then Apps and
            websites. Remove VB POV there.
          </p>
        </FaqItem>

        <FaqItem question="If you're in a clip" defaultOpen>
          <p>
            That is a takedown, not an account delete. Email{" "}
            <a href="mailto:michael@focusotter.com">michael@focusotter.com</a>{" "}
            and I&apos;ll pull the clip. Same note is on the{" "}
            <Link href="/faq">FAQ</Link>.
          </p>
        </FaqItem>
      </div>
    </div>
  );
}
