"use client";

import Link from "next/link";
import { PIN_LABELS } from "@/lib/labels";
import type { PinLabel } from "@/lib/db/schema";
import type { ClipPin } from "@/lib/queries";

export function FeedTagSheet({
  open,
  clipId,
  editHref,
  pin,
  pinsByClip,
  pinCount,
  pending,
  onClose,
  onPickPin,
  onDeleteClip,
}: {
  open: boolean;
  clipId: string;
  editHref: string;
  pin: ClipPin | null;
  pinsByClip: Record<string, ClipPin | null>;
  pinCount: number;
  pending: boolean;
  onClose: () => void;
  onPickPin: (label: PinLabel | null) => void;
  onDeleteClip?: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="feed-sheet-root">
      <button
        type="button"
        className="feed-sheet-backdrop"
        aria-label="Close tags"
        onClick={onClose}
      />
      <div
        className="feed-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-tag-sheet-title"
        data-pin-sheet=""
      >
        <div className="feed-sheet-handle" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="feed-tag-sheet-title" className="display text-2xl">
              Tags
            </h2>
            <p className="meta mt-1">Pin the highlight. Edit tags on the clip page.</p>
          </div>
          <button type="button" className="btn btn-ghost !min-h-10" onClick={onClose}>
            Done
          </button>
        </div>

        <section className="mt-5 space-y-2">
          <h3 className="text-sm text-muted">Session pin</h3>
          <div className="grid gap-2">
            {PIN_LABELS.map((item) => {
              const slug = item.slug as PinLabel;
              const holderId = Object.entries(pinsByClip).find(
                ([id, value]) => value?.label === slug && id !== clipId,
              )?.[0];
              const usedHere = pin?.label === slug;
              const wouldAdd = !pin && !holderId && pinCount >= 3;
              return (
                <button
                  key={slug}
                  type="button"
                  className={`feed-sheet-option ${usedHere ? "is-on" : ""}`}
                  data-pin-option={slug}
                  aria-pressed={usedHere}
                  disabled={pending || wouldAdd}
                  onClick={() => onPickPin(slug)}
                >
                  <span>{item.name}</span>
                  {wouldAdd ? (
                    <span className="meta">Already three pins</span>
                  ) : holderId ? (
                    <span className="meta" data-pin-move="">
                      Moves from another clip
                    </span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              className={`feed-sheet-option ${pin ? "" : "is-on"}`}
              data-pin-option="none"
              aria-pressed={!pin}
              disabled={pending || !pin}
              onClick={() => onPickPin(null)}
            >
              No tag
            </button>
          </div>
        </section>

        <section className="mt-6 flex flex-col gap-2">
          <Link href={editHref} className="btn btn-ghost" data-clip-edit="">
            Edit this clip
          </Link>
          {onDeleteClip ? (
            <button
              type="button"
              className="btn btn-ghost text-error"
              data-delete-from-sheet=""
              onClick={onDeleteClip}
            >
              Delete this clip
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
