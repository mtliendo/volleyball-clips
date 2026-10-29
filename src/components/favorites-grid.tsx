"use client";

import Link from "next/link";
import { useState } from "react";
import { DownloadButton } from "@/components/download-button";
import { DownloadLimitWall } from "@/components/download-limit-wall";
import { cdnUrl } from "@/lib/cdn";
import { formatGameWhen } from "@/lib/dates";
import type { Viewer } from "@/lib/entitlements";
import { PIN_LABEL_COPY } from "@/lib/labels";
import type { PublicClip, PublicGame } from "@/lib/queries";

export type FavoriteClip = PublicClip & {
  venueName: string;
  startsAt: Date;
  gameType: PublicGame["type"];
};

export function FavoritesGrid({
  clips,
  viewer,
}: {
  clips: FavoriteClip[];
  viewer: Viewer;
}) {
  const [downloadsRemaining, setDownloadsRemaining] = useState(viewer.downloadsRemaining);
  const [downloadLimit, setDownloadLimit] = useState<{ nextAt: string | null } | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {clips.map((clip) => {
          const poster = cdnUrl(clip.posterKey);
          const href = `/games/${clip.gameId}/watch/${clip.id}`;
          return (
            <li key={clip.id} className="min-w-0">
              <article className="space-y-2">
                <Link href={href} className="block space-y-2">
                  <div className="poster-frame relative aspect-[9/16]">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" />
                    ) : null}
                    {clip.pin?.label ? (
                      <span className="chip-spark absolute top-2 left-2">
                        {PIN_LABEL_COPY[clip.pin.label]}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm">{clip.venueName}</p>
                  <p className="meta">{formatGameWhen(clip.startsAt)}</p>
                </Link>
                <div className="flex justify-end">
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
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      {downloadLimit ? (
        <div className="fixed inset-0 z-(--z-modal)">
          <DownloadLimitWall nextAt={downloadLimit.nextAt} onBack={() => setDownloadLimit(null)} />
        </div>
      ) : null}
    </>
  );
}
