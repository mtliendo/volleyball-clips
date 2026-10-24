import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipTagEditor } from "@/components/admin/clip-tag-editor";
import { ClipUploader } from "@/components/admin/clip-uploader";
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
          <p className="text-xs uppercase tracking-[0.2em] text-court">
            {GAME_TYPE_LABELS[game.type]}
          </p>
          <h1 className="display text-4xl">{game.venueName}</h1>
          <p className="mt-1 text-sm text-muted">{formatGameWhen(game.startsAt)}</p>
        </div>
        <Link href={`/admin/games/${id}/edit`} className="text-sm text-muted">
          Edit
        </Link>
      </div>
      <ClipUploader gameId={id} />
      <section className="space-y-3">
        <h2 className="display text-2xl">Tags</h2>
        <ClipTagEditor clips={clips} tags={tags} />
      </section>
    </div>
  );
}
