import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { VerifyUrl } from "@/components/verify-url";
import { VerticalFeed } from "@/components/vertical-feed";
import {
  VERIFY_DOWNLOADS_COOKIE,
  VERIFY_GAME_ID,
  verifyCatalogTags,
  verifyClips,
  verifyViewer,
} from "@/lib/verify-feed";

export const dynamic = "force-dynamic";

export default async function VerifyFeedKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; left?: string; wall?: string; next?: string }>;
}) {
  await connection();
  if (process.env.VERIFY_FEED_HARNESS !== "1") {
    notFound();
  }

  const { as, left, wall, next } = await searchParams;
  const clips = verifyClips();
  const jar = await cookies();
  const cookieLeft = Number(jar.get(VERIFY_DOWNLOADS_COOKIE)?.value);
  const fromQuery = left !== undefined ? Number(left) : NaN;
  const remaining = Number.isFinite(fromQuery)
    ? fromQuery
    : Number.isFinite(cookieLeft)
      ? cookieLeft
      : wall === "download"
        ? 0
        : 3;
  const nextDownloadAt =
    next && !Number.isNaN(Date.parse(next))
      ? new Date(next).toISOString()
      : remaining === 0
        ? "2026-11-06T18:00:00.000Z"
        : null;

  return (
    <div data-verify-feed="keys">
      <label className="visually-hidden">
        Verify filter
        <input data-verify-input="" name="verify-filter" />
      </label>
      <VerticalFeed
        clips={clips}
        startId={clips[0].id}
        gameId={VERIFY_GAME_ID}
        tag={null}
        catalogTags={verifyCatalogTags()}
        viewer={verifyViewer({
          isAdmin: as === "admin",
          isPro: as === "pro",
          signedIn: as !== "guest",
          watchUnlimited: wall !== "watch" && as !== "guest",
          canFavorite: as !== "guest",
          canDownload: as !== "guest",
          downloadsRemaining: as === "pro" ? null : remaining,
          nextDownloadAt,
        })}
        closeHref={`/games/${VERIFY_GAME_ID}`}
        forceWall={wall === "watch" || wall === "download" ? wall : null}
      />
      <VerifyUrl />
    </div>
  );
}
