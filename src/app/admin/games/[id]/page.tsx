import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipUploader } from "@/components/admin/clip-uploader";
import { DeleteGameButton } from "@/components/admin/delete-game-button";
import { PinEditor } from "@/components/admin/pin-editor";
import { requireAdminPage } from "@/lib/admin";
import { formatGameWhen } from "@/lib/dates";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { getGameWithVenue, listGameClips } from "@/lib/queries";

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

  const clips = await listGameClips(id);

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
      {clips.length > 0 ? (
        <section className="space-y-3">
          <h2 className="display text-2xl">Clips</h2>
          <p className="meta">Open a clip to edit its tags or delete it. AI tags apply after playback is ready.</p>
          <ul className="space-y-2">
            {clips.map((clip) => (
              <li key={clip.id}>
                <Link href={`/admin/games/${id}/clips/${clip.id}`} className="well flex items-center justify-between gap-3 p-3">
                  <span className="truncate text-sm">
                    {clip.tags.map((tag) => tag.name).join(", ") || "No tags yet"}
                  </span>
                  <span className="meta shrink-0">Edit</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
