import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipTagEditor } from "@/components/admin/clip-tag-editor";
import { ClipUploader } from "@/components/admin/clip-uploader";
import { DeleteGameButton } from "@/components/admin/delete-game-button";
import { PinEditor } from "@/components/admin/pin-editor";
import { requireAdminPage } from "@/lib/admin";
import { formatGameWhen } from "@/lib/dates";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { getGameWithVenue, listGameClips, listTags } from "@/lib/queries";

export default async function AdminGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPage(`/admin/games/${id}`);
  const game = await getGameWithVenue(id);
  if (!game) {
    notFound();
  }

  const [clips, tags] = await Promise.all([listGameClips(id), listTags()]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="meta">{GAME_TYPE_LABELS[game.type]}</p>
          <h1 className="display text-display-s">{game.venueName}</h1>
          <p className="meta mt-1">{formatGameWhen(game.startsAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href={`/admin/games/${id}/edit`} className="text-sm text-muted">
            Edit
          </Link>
          <DeleteGameButton gameId={id} label={game.venueName} href="/admin/games" />
        </div>
      </div>
      <ClipUploader gameId={id} />
      <PinEditor gameId={id} clips={clips} />
      <section className="space-y-3">
        <h2 className="display text-2xl">Tags</h2>
        <ClipTagEditor clips={clips} tags={tags} />
      </section>
    </div>
  );
}
