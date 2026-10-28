import Link from "next/link";
import { formatGameWhen } from "@/lib/dates";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import type { PublicGame } from "@/lib/queries";

export function GameList({
  games,
  emptyLabel,
}: {
  games: PublicGame[];
  emptyLabel: string;
}) {
  if (games.length === 0) {
    return (
      <p className="well px-4 py-8 text-center text-sm text-muted">{emptyLabel}</p>
    );
  }

  return (
    <ul className="grid gap-3">
      {games.map((game) => (
        <li key={game.id}>
          <Link
            href={`/games/${game.id}`}
            className="well block p-4 transition-colors duration-(--dur-micro) ease-out hover:bg-paper-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="display text-2xl leading-none">{game.venueName}</p>
                <p className="meta mt-2">{formatGameWhen(game.startsAt)}</p>
              </div>
              <span className="chip shrink-0">{GAME_TYPE_LABELS[game.type]}</span>
            </div>
            <p className="meta mt-3">
              {game.readyClipCount} {game.readyClipCount === 1 ? "clip" : "clips"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
