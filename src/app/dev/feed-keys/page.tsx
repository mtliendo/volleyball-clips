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
  searchParams: Promise<{ as?: string; left?: string }>;
}) {
  await connection();
  if (process.env.VERIFY_FEED_HARNESS !== "1") {
    notFound();
  }

  const { as, left } = await searchParams;
  const clips = verifyClips();
  const jar = await cookies();
  const cookieLeft = Number(jar.get(VERIFY_DOWNLOADS_COOKIE)?.value);
  const fromQuery = left !== undefined ? Number(left) : NaN;
  const remaining = Number.isFinite(fromQuery)
    ? fromQuery
    : Number.isFinite(cookieLeft)
      ? cookieLeft
      : 3;

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
          canDownload: as !== "guest",
          downloadsRemaining: as === "pro" ? null : remaining,
        })}
        closeHref={`/games/${VERIFY_GAME_ID}`}
      />
      <VerifyUrl />
    </div>
  );
}
