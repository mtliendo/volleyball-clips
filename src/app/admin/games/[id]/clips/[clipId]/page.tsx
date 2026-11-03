import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipEditForm } from "@/components/admin/clip-edit-form";
import { requireAdminPage } from "@/lib/admin";
import { getGameWithVenue, listGameClips, listTags } from "@/lib/queries";

export default async function AdminClipPage({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}) {
  const { id, clipId } = await params;
  await requireAdminPage(`/admin/games/${id}/clips/${clipId}`);

  const game = await getGameWithVenue(id);
  if (!game) {
    notFound();
  }

  const [clips, catalogTags] = await Promise.all([listGameClips(id), listTags()]);
  const clip = clips.find((item) => item.id === clipId);
  if (!clip) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <Link href={`/admin/games/${id}`} className="text-sm text-muted">
        Back to session
      </Link>
      <header className="space-y-1">
        <p className="meta">{game.venueName}</p>
        <h1 className="display text-display-s">Edit clip</h1>
      </header>
      <ClipEditForm clip={clip} catalogTags={catalogTags} gameId={id} />
    </div>
  );
}
