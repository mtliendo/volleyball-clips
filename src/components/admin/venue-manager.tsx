"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Venue = { id: string; name: string };

export function VenueManager({ venues }: { venues: Venue[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function createVenue(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError((await response.json()).error ?? "Could not create venue");
      return;
    }
    setName("");
    router.refresh();
  }

  async function renameVenue(venue: Venue) {
    const next = window.prompt("Venue name", venue.name);
    if (!next || next === venue.name) return;
    await fetch(`/api/admin/venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    router.refresh();
  }

  async function deleteVenue(venue: Venue) {
    if (!window.confirm(`Delete ${venue.name}?`)) return;
    const response = await fetch(`/api/admin/venues/${venue.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError((await response.json()).error ?? "Could not delete venue");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createVenue} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New venue"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-panel-2 px-3 py-3 text-sm outline-none focus:border-court"
          required
        />
        <button
          type="submit"
          className="rounded-2xl bg-court px-4 text-sm font-medium text-background"
        >
          Add
        </button>
      </form>
      {error ? <p className="text-sm text-court">{error}</p> : null}
      <ul className="space-y-2">
        {venues.map((venue) => (
          <li
            key={venue.id}
            className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3"
          >
            <span>{venue.name}</span>
            <div className="flex gap-3 text-sm text-muted">
              <button type="button" onClick={() => renameVenue(venue)}>
                Edit
              </button>
              <button type="button" onClick={() => deleteVenue(venue)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
