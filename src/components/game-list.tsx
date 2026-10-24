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
      <p className="rounded-3xl border border-dashed border-line bg-panel/60 px-4 py-8 text-center text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {games.map((game) => (
        <li key={game.id}>
          <Link
            href={`/games/${game.id}`}
            className="block rounded-3xl border border-line bg-panel p-4 transition hover:border-court/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="display text-2xl leading-none">{game.venueName}</p>
                <p className="mt-2 text-sm text-muted">{formatGameWhen(game.startsAt)}</p>
              </div>
              <span className="rounded-full bg-panel-2 px-3 py-1 text-xs uppercase tracking-wide text-court">
                {GAME_TYPE_LABELS[game.type]}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted">
              {game.readyClipCount} {game.readyClipCount === 1 ? "clip" : "clips"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
