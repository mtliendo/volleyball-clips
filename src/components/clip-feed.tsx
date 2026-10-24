"use client";

import { useMemo, useState } from "react";
import { DeleteClipButton } from "@/components/admin/delete-clip-button";
import { cdnUrl } from "@/lib/cdn";
import { formatDuration } from "@/lib/dates";
import type { PublicClip } from "@/lib/queries";

export function ClipFeed({
  clips,
  tags,
  canManage = false,
}: {
  clips: PublicClip[];
  tags: { id: string; slug: string; name: string }[];
  canManage?: boolean;
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!activeTag) return clips;
    return clips.filter((clip) => clip.tags.some((tag) => tag.slug === activeTag));
  }, [activeTag, clips]);

  if (clips.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line bg-panel/60 px-4 py-10 text-center text-sm text-muted">
        No ready clips for this game yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setActiveTag(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
            activeTag === null ? "bg-court text-background" : "bg-panel-2 text-muted"
          }`}
        >
          All
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => setActiveTag(tag.slug === activeTag ? null : tag.slug)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              activeTag === tag.slug ? "bg-court text-background" : "bg-panel-2 text-muted"
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-panel/60 px-4 py-8 text-center text-sm text-muted">
          No clips match that tag.
        </p>
      ) : (
        <ul className="space-y-6">
          {filtered.map((clip) => {
            const playback = cdnUrl(clip.playbackKey);
            const poster = cdnUrl(clip.posterKey);
            const original = cdnUrl(clip.originalKey);

            return (
              <li key={clip.id} className="overflow-hidden rounded-[28px] border border-line bg-black">
                <div className="relative mx-auto aspect-[9/16] w-full max-w-sm bg-black">
                  {playback ? (
                    <video
                      className="h-full w-full object-contain"
                      poster={poster || undefined}
                      controls
                      playsInline
                      preload="metadata"
                    >
                      <source src={playback} type="video/mp4" />
                    </video>
                  ) : poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-muted">
                      Playback not available
                    </div>
                  )}
                  {clip.durationMs ? (
                    <span className="absolute right-3 bottom-14 rounded-full bg-black/70 px-2 py-0.5 text-xs">
                      {formatDuration(clip.durationMs)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {clip.tags.length === 0 ? (
                      <span className="text-xs text-muted">Untagged</span>
                    ) : (
                      clip.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-panel-2 px-2 py-0.5 text-xs text-muted"
                        >
                          {tag.name}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {canManage ? <DeleteClipButton clipId={clip.id} /> : null}
                    {original ? (
                      <a
                        href={original}
                        className="rounded-full bg-court px-3 py-1.5 text-xs font-medium text-background"
                      >
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
