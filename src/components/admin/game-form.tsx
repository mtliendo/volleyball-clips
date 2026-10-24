"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_TYPE_LABELS } from "@/lib/labels";

const TYPES = ["open_gym", "league", "tournament"] as const;

export function GameForm({
  venues,
  game,
  successHref,
}: {
  venues: { id: string; name: string }[];
  game?: {
    id: string;
    venueId: string;
    startsAtLocal: string;
    type: (typeof TYPES)[number];
  };
  successHref?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      venueId: String(form.get("venueId")),
      startsAt: String(form.get("startsAt")),
      type: String(form.get("type")),
    };

    const response = await fetch(
      game ? `/api/admin/games/${game.id}` : "/api/admin/games",
      {
        method: game ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not save game");
      setPending(false);
      return;
    }

    router.push(successHref ?? `/admin/games/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2 text-sm">
        <span className="text-muted">Venue</span>
        <select
          name="venueId"
          defaultValue={game?.venueId}
          required
          className="w-full rounded-2xl border border-line bg-panel-2 px-3 py-3 outline-none focus:border-court"
        >
          <option value="">Select a venue</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        <span className="text-muted">Starts at</span>
        <input
          type="datetime-local"
          name="startsAt"
          defaultValue={game?.startsAtLocal}
          required
          className="w-full rounded-2xl border border-line bg-panel-2 px-3 py-3 outline-none focus:border-court"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span className="text-muted">Type</span>
        <select
          name="type"
          defaultValue={game?.type ?? "open_gym"}
          className="w-full rounded-2xl border border-line bg-panel-2 px-3 py-3 outline-none focus:border-court"
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {GAME_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-court">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-court py-3 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : game ? "Save game" : "Create game"}
      </button>
    </form>
  );
}
