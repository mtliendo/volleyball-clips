"use client";

import { useState } from "react";
import { DeleteGameButton } from "@/components/admin/delete-game-button";
import { GameForm } from "@/components/admin/game-form";
import type { GameType } from "@/lib/db/schema";

export function GameAdminPanel({
  venues,
  game,
}: {
  venues: { id: string; name: string }[];
  game: {
    id: string;
    venueId: string;
    venueName: string;
    startsAtLocal: string;
    type: GameType;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="well space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Admin actions</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-sm text-muted"
          >
            {open ? "Close" : "Edit game"}
          </button>
          <DeleteGameButton gameId={game.id} label={game.venueName} href="/" />
        </div>
      </div>
      {open ? (
        <GameForm venues={venues} game={game} successHref={`/games/${game.id}`} />
      ) : null}
    </section>
  );
}
