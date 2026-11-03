"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DeleteClipButton } from "@/components/admin/delete-clip-button";
import { cdnUrl } from "@/lib/cdn";
import { CLIP_STATUS_LABELS } from "@/lib/labels";
import type { PublicClip } from "@/lib/queries";

export function ClipEditForm({
  clip,
  catalogTags,
  gameId,
}: {
  clip: PublicClip;
  catalogTags: { id: string; slug: string; name: string }[];
  gameId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(clip.tags.map((tag) => tag.id)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(clip.tagsLocked);

  const selectedNames = useMemo(
    () => catalogTags.filter((tag) => selected.has(tag.id)).map((tag) => tag.name),
    [catalogTags, selected],
  );

  async function save(nextIds: string[]) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/admin/clips/${clip.id}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: nextIds }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not save tags");
      setPending(false);
      return;
    }
    setLocked(true);
    setPending(false);
    router.refresh();
  }

  function toggle(tagId: string) {
    const next = new Set(selected);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    setSelected(next);
    void save([...next]);
  }

  function useAiTags() {
    const mapped = new Set(clip.ai?.mappedTagSlugs ?? []);
    const next = catalogTags.filter((tag) => mapped.has(tag.slug)).map((tag) => tag.id);
    setSelected(new Set(next));
    void save(next);
  }

  const poster = cdnUrl(clip.posterKey);
  const ai = clip.ai;

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-black">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted">
              {CLIP_STATUS_LABELS[clip.status]}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="chip w-fit">{CLIP_STATUS_LABELS[clip.status]}</p>
          <p className="meta">
            {selectedNames.join(", ") || "No tags yet"}
            {locked ? " · edited" : ai?.status === "done" ? " · from AI" : ""}
          </p>
          <DeleteClipButton clipId={clip.id} redirectTo={`/admin/games/${gameId}`} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="display text-2xl">Tags</h2>
        <p className="meta">
          Add or remove tags for this clip. Saving here keeps later AI runs from changing them.
        </p>
        <div className="flex flex-wrap gap-2">
          {catalogTags.map((tag) => {
            const on = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={`chip ${on ? "chip-active" : ""}`}
                data-play-tag={tag.slug}
                aria-pressed={on}
                disabled={pending}
                onClick={() => toggle(tag.id)}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="display text-2xl">AI</h2>
        {!ai ? (
          <p className="meta">No AI result yet. Tagging starts after the 1080p copy is ready.</p>
        ) : ai.status === "pending" ? (
          <p className="meta">AI tagging is in progress.</p>
        ) : ai.status === "failed" ? (
          <p className="text-sm text-error">{ai.error || "AI tagging failed."}</p>
        ) : (
          <div className="space-y-3">
            <p>{ai.summary}</p>
            {ai.mappedTagSlugs.length > 0 ? (
              <p className="meta">AI tags: {ai.mappedTagSlugs.join(", ")}</p>
            ) : null}
            {locked ? (
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={useAiTags}>
                Use AI tags
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
