"use client";

import { useRouter } from "next/navigation";
import { cdnUrl } from "@/lib/cdn";
import { formatDuration } from "@/lib/dates";
import { CLIP_STATUS_LABELS } from "@/lib/labels";
import type { PublicClip } from "@/lib/queries";

export function ClipTagEditor({
  clips,
  tags,
}: {
  clips: PublicClip[];
  tags: { id: string; slug: string; name: string }[];
}) {
  const router = useRouter();

  async function toggleTag(clipId: string, tagId: string, checked: boolean) {
    const clip = clips.find((item) => item.id === clipId);
    const next = new Set(clip?.tags.map((tag) => tag.id) ?? []);
    if (checked) {
      next.add(tagId);
    } else {
      next.delete(tagId);
    }

    await fetch(`/api/admin/clips/${clipId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: [...next] }),
    });
    router.refresh();
  }

  if (clips.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line bg-panel/60 px-4 py-8 text-center text-sm text-muted">
        No clips on this game yet.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {clips.map((clip) => {
        const selected = new Set(clip.tags.map((tag) => tag.id));
        const poster = cdnUrl(clip.posterKey);

        return (
          <li key={clip.id} className="rounded-3xl border border-line bg-panel p-4">
            <div className="flex gap-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[10px] text-muted">
                    {CLIP_STATUS_LABELS[clip.status]}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="rounded-full bg-panel-2 px-2 py-0.5 text-xs text-muted">
                    {CLIP_STATUS_LABELS[clip.status]}
                  </span>
                  <span className="text-xs text-muted">{formatDuration(clip.durationMs)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        selected.has(tag.id)
                          ? "bg-court text-background"
                          : "bg-panel-2 text-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected.has(tag.id)}
                        onChange={(event) =>
                          void toggleTag(clip.id, tag.id, event.target.checked)
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
