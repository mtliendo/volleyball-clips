import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipFeed } from "@/components/clip-feed";
import { formatGameWhen } from "@/lib/dates";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { getGameWithVenue, listGameClips, listTags } from "@/lib/queries";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGameWithVenue(id);
  if (!game) {
    notFound();
  }

  const [clips, tags] = await Promise.all([
    listGameClips(id, { readyOnly: true }),
    listTags(),
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
      <ClipFeed clips={clips} tags={tags} />
    </div>
  );
}
