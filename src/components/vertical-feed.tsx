"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadButton } from "@/components/download-button";
import { FavoriteButton } from "@/components/favorite-button";
import { SignupWall } from "@/components/signup-wall";
import { cdnUrl } from "@/lib/cdn";
import type { Viewer } from "@/lib/entitlements";
import { PIN_LABEL_COPY } from "@/lib/labels";
import type { PublicClip } from "@/lib/queries";

export function VerticalFeed({
  clips,
  startId,
  gameId,
  tag,
  viewer,
  closeHref,
}: {
  clips: PublicClip[];
  startId: string;
  gameId: string;
  tag: string | null;
  viewer: Viewer;
  closeHref: string;
}) {
  const router = useRouter();
  const startIndex = Math.max(0, clips.findIndex((clip) => clip.id === startId));
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [watchState, setWatchState] = useState<{ clipId: string; blocked: boolean } | null>(
    null,
  );
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  const ordered = useMemo(() => clips, [clips]);
  const active = ordered[activeIndex];

  useEffect(() => {
    const node = scroller.current?.children[startIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "start" });
  }, [startIndex]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.index);
        if (Number.isFinite(index)) {
          setActiveIndex(index);
        }
      },
      { root, threshold: [0.6, 0.9] },
    );

    for (const child of Array.from(root.children)) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [ordered.length]);

  useEffect(() => {
    videos.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [activeIndex]);

  useEffect(() => {
    if (!active) return;
    const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
    router.replace(`/games/${gameId}/watch/${active.id}${query}`, { scroll: false });
  }, [active, gameId, router, tag]);

  useEffect(() => {
    if (!active || viewer.watchUnlimited) {
      return;
    }

    let cancelled = false;
    void fetch("/api/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId: active.id }),
    }).then((response) => {
      if (cancelled) return;
      const blocked = response.status === 403;
      if (blocked) {
        videos.current[activeIndex]?.pause();
      }
      setWatchState({ clipId: active.id, blocked });
    });

    return () => {
      cancelled = true;
    };
  }, [active, activeIndex, viewer.watchUnlimited]);

  const blocked =
    !viewer.watchUnlimited &&
    Boolean(active) &&
    watchState?.clipId === active?.id &&
    watchState.blocked;

  if (ordered.length === 0 || !active) {
    return (
      <div className="grid min-h-svh place-items-center bg-paper px-4">
        <p className="text-sm text-muted">No clips in this filter.</p>
        <Link href={closeHref} className="btn btn-ghost mt-4">
          Back to the session
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-svh bg-paper text-ink">
      <div
        ref={scroller}
        className="h-svh snap-y snap-mandatory overflow-y-auto"
      >
        {ordered.map((clip, index) => {
          const playback = cdnUrl(clip.playbackKey);
          const poster = cdnUrl(clip.posterKey);
          const near = Math.abs(index - activeIndex) <= 1;

          return (
            <section
              key={clip.id}
              data-index={index}
              className="relative h-svh w-full snap-start"
            >
              {playback ? (
                <video
                  ref={(node) => {
                    videos.current[index] = node;
                  }}
                  className="h-full w-full object-contain bg-paper"
                  poster={poster || undefined}
                  playsInline
                  muted
                  loop
                  preload={near ? "auto" : "none"}
                  controls={false}
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
            </section>
          );
        })}
      </div>

      <div className="feed-scrim-top" />
      <div className="feed-scrim-bottom" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-(--z-raised) flex items-start justify-between p-3">
        <Link href={closeHref} className="pointer-events-auto btn btn-ghost !min-h-10">
          Close
        </Link>
        {active.pin ? (
          <span className="chip-spark pointer-events-none">
            {active.pin.label ? PIN_LABEL_COPY[active.pin.label] : "Pinned"}
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-3 bottom-20 z-(--z-raised) flex flex-col items-center gap-3">
        <div className="pointer-events-auto">
          <FavoriteButton
            clipId={active.id}
            favorited={active.favorited}
            canFavorite={viewer.canFavorite}
            returnTo={`/games/${gameId}/watch/${active.id}`}
          />
        </div>
        <div className="pointer-events-auto">
          <DownloadButton
            clipId={active.id}
            canDownload={viewer.canDownload}
            isPro={viewer.isPro}
            remaining={viewer.downloadsRemaining}
            returnTo={`/games/${gameId}/watch/${active.id}`}
            compact
          />
        </div>
      </div>

      {viewer.downloadsRemaining !== null && viewer.canDownload ? (
        <p className="pointer-events-none absolute bottom-5 left-4 z-(--z-raised) text-xs text-muted">
          {viewer.downloadsRemaining} downloads left this week
        </p>
      ) : null}

      {blocked ? (
        <div className="absolute inset-0 z-(--z-modal)">
          <SignupWall returnTo={`/games/${gameId}/watch/${active.id}`} />
        </div>
      ) : null}
    </div>
  );
}
