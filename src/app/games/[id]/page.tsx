import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GameAdminPanel } from "@/components/admin/game-admin-panel";
import { ClipFeed } from "@/components/clip-feed";
import { getSession, isAdmin } from "@/lib/admin";
import { formatGameWhen, toDatetimeLocalValue } from "@/lib/dates";
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

  const session = await getSession();
  const admin = isAdmin(session);
  const [clips, tags, venues] = await Promise.all([
    listGameClips(id, { readyOnly: true }),
    listTags(),
    admin ? listVenues() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-muted">
        ← Calendar
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-court">
          {GAME_TYPE_LABELS[game.type]}
        </p>
        <h1 className="display mt-1 text-4xl">{game.venueName}</h1>
        <p className="mt-2 text-sm text-muted">{formatGameWhen(game.startsAt)}</p>
      </header>
      {admin ? (
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
      <ClipFeed clips={clips} tags={tags} canManage={admin} />
    </div>
  );
}
