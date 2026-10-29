import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ANON_WATCH_LIMIT, FREE_DOWNLOADS_PER_WEEK } from "@/lib/db/schema";
import { faqPageMetadata } from "@/lib/share-metadata";

export const metadata: Metadata = faqPageMetadata();

export default function FaqPage() {
  return (
    <div className="container space-y-8 py-10">
      <header className="space-y-3">
        <h1 className="display text-display">FAQ</h1>
        <p className="lead">
          Straight answers. I film the games, pick the clips, and run the site.
        </p>
      </header>

      <div className="faq-list">
        <FaqItem question="I'm in a clip. Can you take it down?">
          <p>
            Yes. Email{" "}
            <a href="mailto:michael@focusotter.com">michael@focusotter.com</a>{" "}
            and I&apos;ll take it down.
          </p>
        </FaqItem>

        <FaqItem question="How do you pick the clips?">
          <p>
            I watch what I filmed and keep the ones that are fun for everyone.
            They usually run longer than 10 seconds. Short noise doesn&apos;t
            make it.
          </p>
        </FaqItem>

        <FaqItem question="What's free and what's Pro?">
          <p>
            Watching is free. A free account can heart clips and download{" "}
            {FREE_DOWNLOADS_PER_WEEK} a week in 1080p. Pro is $5 a month.
          </p>
        </FaqItem>

        <FaqItem question="Why did watching stop if I don't have an account?">
          <p>
            Guests get {ANON_WATCH_LIMIT} clips a day. Pins count. Sign up and
            you can watch as much as you want.
          </p>
        </FaqItem>

        <FaqItem question="How many downloads do free accounts get?">
          <p>
            {FREE_DOWNLOADS_PER_WEEK} each rolling week, and those are the 1080p
            copies, not the original glasses files. After that, wait until the
            oldest one ages off or go Pro.
          </p>
        </FaqItem>

        <FaqItem question="What does Pro get?">
          <p>
            Unlimited downloads, including the original files from the glasses.
            Those are about 1400 × 1900 at 120 fps. The 1080p copy is just for
            watching.
          </p>
        </FaqItem>

        <FaqItem question="How do I cancel Pro?">
          <p>
            Open <Link href="/pricing">Pricing</Link> and tap Update card or
            cancel. That sends you to the Stripe billing portal. If you cancel,
            Pro stays on until the period ends.
          </p>
        </FaqItem>

        <FaqItem question="Where are these filmed?">
          <p>
            At the gyms on the calendar. Each session is labeled with the gym
            name. Open gym, league, and tournament nights all show up there.
          </p>
        </FaqItem>

        <FaqItem question="How do I find my games?">
          <p>
            Start on the home calendar. Pick the night, then open the session for
            that gym.
          </p>
        </FaqItem>

        <FaqItem question="Why can't I favorite a clip?">
          <p>
            Favorites need a free account. After you sign in, tap the heart and
            they show up under Favorites.
          </p>
        </FaqItem>
      </div>
    </div>
  );
}

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <details className="faq-item">
      <summary>{question}</summary>
      <div className="faq-answer">{children}</div>
    </details>
  );
}
