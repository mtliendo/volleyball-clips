import type { Metadata } from "next";
import Link from "next/link";
import { FaqItem } from "@/components/faq-item";
import { privacyPageMetadata } from "@/lib/share-metadata";

export const metadata: Metadata = privacyPageMetadata();

export default function PrivacyPage() {
  return (
    <div className="container space-y-8 py-10">
      <header className="space-y-3">
        <h1 className="display text-display">Privacy</h1>
        <p className="lead">
          What I collect, why, and how to get it deleted. No lawyer copy. This
          is what the site actually does.
        </p>
        <p className="meta">Last updated: October 29, 2026</p>
      </header>

      <div className="faq-list">
        <FaqItem question="Who runs this" defaultOpen>
          <p>
            VB POV is run by me, Michael Liendo (Focus). Email{" "}
            <a href="mailto:michael@focusotter.com">michael@focusotter.com</a>.
          </p>
        </FaqItem>

        <FaqItem question="What I get when you sign up" defaultOpen>
          <p>
            Sign-in goes through Auth0. You can use email and password, Google,
            or Facebook. Auth0 sends me your email and name. Google or Facebook
            also send a profile picture. I save your email and name in my
            database so the account sticks. I do not store the picture.
          </p>
        </FaqItem>

        <FaqItem question="Payments" defaultOpen>
          <p>
            If you go Pro, Stripe takes the card. I never see the number. I
            keep Stripe&apos;s customer id, subscription id, status, and when
            the period ends so I know if Pro is on.
          </p>
        </FaqItem>

        <FaqItem question="What sits in my database" defaultOpen>
          <p>
            A Postgres database on Neon holds your account row, the clips you
            heart, download records (which clip, 1080p or original, and when),
            and subscription status. For guests I also store watch records: a
            random visitor id, a hashed IP (not the raw address), the clip, and
            the day. That is how the 7-a-day guest limit works. Signed-in
            people can watch without those records.
          </p>
        </FaqItem>

        <FaqItem question="Cookies and local storage" defaultOpen>
          <p>
            Auth0 sets a session cookie so you stay signed in. Guests get a
            visitor cookie (HttpOnly, one year) so I can count the daily watch
            limit. In your browser I save whether sound is on and whether you
            have already seen the swipe hint.
          </p>
        </FaqItem>

        <FaqItem question="Analytics" defaultOpen>
          <p>
            Vercel Web Analytics and Speed Insights run on the site. They count
            page views, a few in-app events (watch, favorite, download, sign
            up, checkout), and how fast pages feel. They do not set their own
            cookies.
          </p>
        </FaqItem>

        <FaqItem question="Where the videos live" defaultOpen>
          <p>
            Clips I film live on AWS (S3 and CloudFront). Those are the files,
            not your account.
          </p>
        </FaqItem>

        <FaqItem question="I don't sell this" defaultOpen>
          <p>
            I do not sell your data. I do not pass it to advertisers. Auth0,
            Stripe, Vercel, and AWS see what they need to run sign-in,
            payments, hosting, and the video files.
          </p>
        </FaqItem>

        <FaqItem question="If you're in a clip" defaultOpen>
          <p>
            Email{" "}
            <a href="mailto:michael@focusotter.com">michael@focusotter.com</a>{" "}
            and I&apos;ll take it down. Same answer on the{" "}
            <Link href="/faq">FAQ</Link>.
          </p>
        </FaqItem>

        <FaqItem question="How long I keep it" defaultOpen>
          <p>
            Account data, favorites, downloads, and subscription status stay
            while the account exists. Guest watch records stay so the daily
            limit works. There is no automatic wipe in the app. Email me and I
            delete your account data. See{" "}
            <Link href="/data-deletion">how to delete</Link>.
          </p>
        </FaqItem>
      </div>
    </div>
  );
}
