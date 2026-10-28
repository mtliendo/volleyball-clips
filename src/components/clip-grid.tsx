"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeleteClipButton } from "@/components/admin/delete-clip-button";
import { DownloadButton } from "@/components/download-button";
import { DownloadLimitWall } from "@/components/download-limit-wall";
import { FavoriteButton } from "@/components/favorite-button";
import { cdnUrl } from "@/lib/cdn";
import { formatDuration } from "@/lib/dates";
import { PIN_LABEL_COPY } from "@/lib/labels";
import type { PublicClip } from "@/lib/queries";
import type { Viewer } from "@/lib/entitlements";

export function ClipGrid({
  clips,
  tags,
  gameId,
  viewer,
  canManage = false,
}: {
  clips: PublicClip[];
  tags: { id: string; slug: string; name: string }[];
  gameId: string;
  viewer: Viewer;
  canManage?: boolean;
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [downloadsRemaining, setDownloadsRemaining] = useState(viewer.downloadsRemaining);
  const [downloadLimit, setDownloadLimit] = useState<{ nextAt: string | null } | null>(null);

  const filtered = useMemo(() => {
    if (!activeTag) return clips;
    return clips.filter((clip) => clip.tags.some((tag) => tag.slug === activeTag));
  }, [activeTag, clips]);

  if (clips.length === 0) {
    return (
      <p className="well px-4 py-10 text-center text-sm text-muted">
        No ready clips for this session yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setActiveTag(null)}
          className={`chip shrink-0 ${activeTag === null ? "chip-active" : ""}`}
        >
          All
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => setActiveTag(tag.slug === activeTag ? null : tag.slug)}
            className={`chip shrink-0 ${activeTag === tag.slug ? "chip-active" : ""}`}
          >
            {tag.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="well px-4 py-8 text-center text-sm text-muted">
          No clips match that tag.
        </p>
      ) : (
        <ul className="-mx-4 grid grid-cols-2 gap-1 sm:mx-0 sm:grid-cols-3 sm:gap-2">
          {filtered.map((clip) => {
            const poster = cdnUrl(clip.posterKey);
            const href = `/games/${gameId}/watch/${clip.id}${
              activeTag ? `?tag=${encodeURIComponent(activeTag)}` : ""
            }`;

            return (
              <li key={clip.id} className="min-w-0">
                <article className="space-y-2">
                  <Link href={href} className="poster-frame relative block aspect-[9/16]">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-muted">
                        No poster
                      </div>
                    )}
                    {clip.pin ? (
                      <span className="chip-spark absolute top-2 left-2">
                        {clip.pin.label ? PIN_LABEL_COPY[clip.pin.label] : "Pinned"}
                      </span>
                    ) : null}
                    {clip.durationMs ? (
                      <span className="absolute right-2 bottom-2 rounded-card bg-paper/80 px-2 py-0.5 text-xs">
                        {formatDuration(clip.durationMs)}
                      </span>
                    ) : null}
                  </Link>
                  <div className="flex items-center justify-between gap-1 px-1 sm:px-0">
                    <div className="min-w-0 truncate text-xs text-muted">
                      {clip.tags.map((tag) => tag.name).join(", ") || "Untagged"}
                    </div>
                    <div className="flex shrink-0 items-center">
                      <FavoriteButton
                        clipId={clip.id}
                        favorited={clip.favorited}
                        canFavorite={viewer.canFavorite}
                        returnTo={href}
                      />
                      <DownloadButton
                        clipId={clip.id}
                        canDownload={viewer.canDownload}
                        isPro={viewer.isPro}
                        remaining={downloadsRemaining}
                        returnTo={href}
                        compact
                        nextDownloadAt={viewer.nextDownloadAt}
                        onRemainingChange={setDownloadsRemaining}
                        onLimit={(info) => setDownloadLimit(info)}
                      />
                      {canManage ? <DeleteClipButton clipId={clip.id} /> : null}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {downloadLimit ? (
        <div className="fixed inset-0 z-(--z-modal)">
          <DownloadLimitWall nextAt={downloadLimit.nextAt} onBack={() => setDownloadLimit(null)} />
        </div>
      ) : null}
    </div>
  );
}
