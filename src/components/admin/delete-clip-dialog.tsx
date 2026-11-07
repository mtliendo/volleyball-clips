"use client";

import { useEffect, useRef } from "react";
import { cdnUrl } from "@/lib/cdn";
import { formatDuration } from "@/lib/dates";
import { PIN_LABEL_COPY } from "@/lib/labels";
import type { PublicClip } from "@/lib/queries";

function focusableButtons(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
}

export function DeleteClipDialog({
  open,
  clip,
  index,
  total,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  clip: PublicClip | null;
  index: number;
  total: number;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (pending) return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const buttons = focusableButtons(node);
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus();
    };
  }, [onCancel, open, pending]);

  if (!open || !clip) {
    return null;
  }

  const poster = cdnUrl(clip.posterKey);
  const duration = formatDuration(clip.durationMs);
  const tags = clip.tags.map((tag) => tag.name).join(", ") || "Untagged";
  const pin = clip.pin?.label ? PIN_LABEL_COPY[clip.pin.label] : null;
  const position =
    total > 0 && index >= 0 ? `Clip ${index + 1} of ${total}` : "This clip";

  return (
    <div className="feed-delete-root">
      <button
        type="button"
        className="feed-delete-backdrop"
        aria-label="Cancel delete"
        disabled={pending}
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div
        ref={dialogRef}
        className="feed-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-delete-title"
        aria-describedby="feed-delete-copy"
        data-delete-dialog=""
        data-delete-clip={clip.id}
        aria-busy={pending}
      >
        <h2 id="feed-delete-title" className="display text-2xl">
          Delete this clip?
        </h2>
        <div className="mt-4 flex gap-3">
          <div className="feed-delete-poster">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" />
            ) : (
              <span className="grid h-full place-items-center px-1 text-center text-xs text-muted">
                No poster
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm" data-delete-identity="">
              {position}
            </p>
            <p className="meta" data-delete-details="">
              {[tags, duration, pin].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <p id="feed-delete-copy" className="mt-4 text-sm">
          The original, playback, and poster files will be removed. This cannot be
          undone.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-error" data-delete-error="" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="btn btn-danger"
            data-delete-confirm=""
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting…" : "Delete clip"}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost"
            data-delete-cancel=""
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
