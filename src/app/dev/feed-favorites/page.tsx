import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { VerticalFeed } from "@/components/vertical-feed";
import { parseYearMonth } from "@/lib/dates";
import type { Viewer } from "@/lib/entitlements";
import { listGameClips, listMonthGames } from "@/lib/queries";

export const dynamic = "force-dynamic";

const VERIFY_FAVS_COOKIE = "vb_verify_favs";

const VERIFY_VIEWER: Viewer = {
  signedIn: true,
  isAdmin: false,
  isPro: false,
  watchUnlimited: true,
  canFavorite: true,
  canDownload: false,
  downloadsRemaining: null,
  stripeReady: false,
  authReady: true,
  email: "verify@vbpov.test",
  name: "Verify",
  appUserId: null,
};

export default async function VerifyFeedFavoritesPage() {
  await connection();
  if (process.env.VERIFY_FEED_HARNESS !== "1") {
    notFound();
  }

  const games = await listMonthGames(parseYearMonth("2026-10"));
  const game = games.find((item) => item.readyClipCount >= 3);
  if (!game) {
    notFound();
  }

  const clips = await listGameClips(game.id, { readyOnly: true });
  if (clips.length < 3) {
    notFound();
  }

  const favs = new Set(
    ((await cookies()).get(VERIFY_FAVS_COOKIE)?.value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const feed = clips.map((clip) => ({ ...clip, favorited: favs.has(clip.id) }));

  return (
    <VerticalFeed
      clips={feed}
      startId={feed[0].id}
      gameId={game.id}
      tag={null}
      viewer={VERIFY_VIEWER}
      closeHref={`/games/${game.id}`}
    />
  );
}
