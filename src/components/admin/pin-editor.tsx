"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MAX_PINS_PER_SESSION, type PinLabel } from "@/lib/db/schema";
import { PIN_LABELS } from "@/lib/labels";
import type { PublicClip } from "@/lib/queries";

type Slot = {
  clipId: string;
  label: PinLabel | "";
};

function slotsFromClips(clips: PublicClip[]): Slot[] {
  const pinned = clips
    .filter((clip) => clip.pin)
    .sort((a, b) => (a.pin?.position ?? 0) - (b.pin?.position ?? 0))
    .map((clip) => ({
      clipId: clip.id,
      label: (clip.pin?.label ?? "") as PinLabel | "",
    }));
  while (pinned.length < MAX_PINS_PER_SESSION) {
    pinned.push({ clipId: "", label: "" });
  }
  return pinned.slice(0, MAX_PINS_PER_SESSION);
}

export function PinEditor({
  gameId,
  clips,
}: {
  gameId: string;
  clips: PublicClip[];
}) {
  const router = useRouter();
  const ready = useMemo(() => clips.filter((clip) => clip.status === "ready"), [clips]);
  const [slots, setSlots] = useState<Slot[]>(() => slotsFromClips(clips));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function update(index: number, patch: Partial<Slot>) {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  async function save() {
    setPending(true);
    setError("");
    const pins = slots
      .filter((slot) => slot.clipId)
      .map((slot) => ({
        clipId: slot.clipId,
        label: slot.label || null,
      }));
    const response = await fetch(`/api/admin/games/${gameId}/pins`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pins }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not save pins");
      setPending(false);
      return;
    }
    setPending(false);
    router.refresh();
  }

  return (
    <section className="well space-y-4 p-4">
      <div>
        <h2 className="display text-2xl">Session pins</h2>
        <p className="meta mt-1">
          Up to three, shown first. Each label can be used once. Pins are optional.
        </p>
      </div>
      <div className="grid gap-3">
        {slots.map((slot, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Clip {index + 1}</span>
              <select
                className="field"
                value={slot.clipId}
                onChange={(event) => update(index, { clipId: event.target.value })}
              >
                <option value="">None</option>
                {ready.map((clip) => (
                  <option key={clip.id} value={clip.id}>
                    {clip.tags.map((tag) => tag.name).join(", ") || "Untagged"}{" "}
                    {clip.durationMs ? `(${Math.round(clip.durationMs / 1000)}s)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Label</span>
              <select
                className="field"
                value={slot.label}
                onChange={(event) =>
                  update(index, { label: event.target.value as PinLabel | "" })
                }
              >
                <option value="">No label</option>
                {PIN_LABELS.map((label) => (
                  <option key={label.slug} value={label.slug}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void save()}>
        {pending ? "Saving…" : "Save pins"}
      </button>
    </section>
  );
}
