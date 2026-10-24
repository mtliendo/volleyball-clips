import { GameForm } from "@/components/admin/game-form";
import { requireAdminPage } from "@/lib/admin";
import { listVenues } from "@/lib/queries";

export default async function NewGamePage() {
  await requireAdminPage("/admin/games/new");
  const venues = await listVenues();

  return (
    <div className="space-y-4">
      <h1 className="display text-4xl">New game</h1>
      {venues.length === 0 ? (
        <p className="text-sm text-muted">
          Add a venue first, then come back to create a game.
        </p>
      ) : (
        <GameForm venues={venues} />
      )}
    </div>
  );
}
