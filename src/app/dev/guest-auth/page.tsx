import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DownloadButton } from "@/components/download-button";
import { FavoriteButton } from "@/components/favorite-button";
import { VERIFY_CLIP_IDS } from "@/lib/verify-feed";

export const dynamic = "force-dynamic";

export default async function VerifyGuestAuthPage() {
  await connection();
  if (process.env.VERIFY_FEED_HARNESS !== "1") {
    notFound();
  }

  const clipId = VERIFY_CLIP_IDS[0];
  const returnTo = "/dev/guest-auth";

  return (
    <div className="container space-y-8 py-10" data-verify-guest-auth="">
      <header className="space-y-2">
        <h1 className="display text-display-s">Guest auth</h1>
        <p className="lead">Logged-out download and favorite should open Auth0.</p>
      </header>

      <section className="well space-y-4 p-5" data-verify-guest-surface="compact">
        <p className="meta">Feed / session compact</p>
        <div className="flex justify-end">
          <FavoriteButton
            clipId={clipId}
            favorited={false}
            canFavorite={false}
            returnTo={returnTo}
          />
          <DownloadButton
            clipId={clipId}
            canDownload={false}
            isPro={false}
            remaining={null}
            returnTo={returnTo}
            compact
          />
        </div>
      </section>

      <section className="well space-y-4 p-5" data-verify-guest-surface="full">
        <p className="meta">Full download prompt</p>
        <DownloadButton
          clipId={clipId}
          canDownload={false}
          isPro={false}
          remaining={null}
          returnTo={returnTo}
        />
      </section>
    </div>
  );
}
