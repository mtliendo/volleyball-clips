import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GameAdminPanel } from "@/components/admin/game-admin-panel";
import { ClipGrid } from "@/components/clip-grid";
import { formatGameWhen, toDatetimeLocalValue } from "@/lib/dates";
import { getViewer } from "@/lib/entitlements";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { getGameWithVenue, listGameClips, listTags, listVenues } from "@/lib/queries";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const game = await getGameWithVenue(id);
  if (!game) {
    notFound();
  }

  const viewer = await getViewer();
  const [clips, tags, venues] = await Promise.all([
    listGameClips(id, { readyOnly: true, favoriteUserId: viewer.appUserId }),
    listTags(),
    viewer.isAdmin ? listVenues() : Promise.resolve([]),
  ]);

  return (
    <div className="container space-y-5 py-6">
      <Link href="/" className="text-sm text-muted">
        Back to nights
      </Link>
      <header className="space-y-2">
        <p className="meta">{GAME_TYPE_LABELS[game.type]}</p>
        <h1 className="display text-display-s">{game.venueName}</h1>
        <p className="meta">{formatGameWhen(game.startsAt)}</p>
      </header>
      {viewer.isAdmin ? (
        <GameAdminPanel
          venues={venues}
          game={{
            id: game.id,
            venueId: game.venueId,
            venueName: game.venueName,
            startsAtLocal: toDatetimeLocalValue(game.startsAt),
            type: game.type,
          }}
        />
      ) : null}
      {viewer.canDownload && viewer.downloadsRemaining !== null ? (
        <p className="meta">{viewer.downloadsRemaining} downloads left this week, in 1080p</p>
      ) : null}
      <ClipGrid clips={clips} tags={tags} gameId={game.id} viewer={viewer} canManage={viewer.isAdmin} />
    </div>
  );
}
