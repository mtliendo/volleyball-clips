import { notFound } from "next/navigation";
import { GameForm } from "@/components/admin/game-form";
import { requireAdminPage } from "@/lib/admin";
import { toDatetimeLocalValue } from "@/lib/dates";
import { getGameWithVenue, listVenues } from "@/lib/queries";

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPage(`/admin/games/${id}/edit`);
  const [game, venues] = await Promise.all([getGameWithVenue(id), listVenues()]);
  if (!game) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="display text-4xl">Edit game</h1>
      <GameForm
        venues={venues}
        game={{
          id: game.id,
          venueId: game.venueId,
          startsAtLocal: toDatetimeLocalValue(game.startsAt),
          type: game.type,
        }}
      />
    </div>
  );
}
