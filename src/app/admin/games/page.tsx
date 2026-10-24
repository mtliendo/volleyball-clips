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
        <h1 className="display text-4xl">Games</h1>
        <Link href="/admin/games/new" className="rounded-full bg-court px-3 py-1.5 text-sm text-background">
          New
        </Link>
      </div>
      {games.length === 0 ? (
        <p className="text-sm text-muted">No games yet.</p>
      ) : (
        <ul className="space-y-2">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                href={`/admin/games/${game.id}`}
                className="block rounded-3xl border border-line bg-panel p-4"
              >
                <p className="font-medium">{game.venueName}</p>
                <p className="text-sm text-muted">
                  {formatGameWhen(game.startsAt)} · {GAME_TYPE_LABELS[game.type]}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
