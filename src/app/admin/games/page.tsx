import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { formatGameWhen } from "@/lib/dates";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { listAdminGames } from "@/lib/queries";

export default async function AdminGamesPage() {
  await requireAdminPage("/admin/games");
  const games = await listAdminGames();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="display text-section">Sessions</h1>
        <Link href="/admin/games/new" className="btn btn-primary !min-h-9">
          New
        </Link>
      </div>
      {games.length === 0 ? (
        <p className="meta">No sessions yet.</p>
      ) : (
        <ul className="space-y-2">
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/admin/games/${game.id}`} className="well block p-4">
                <p className="font-medium">{game.venueName}</p>
                <p className="meta">
                  {formatGameWhen(game.startsAt)}
                  <span className="block">{GAME_TYPE_LABELS[game.type]}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
