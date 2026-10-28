"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DownloadButton } from "@/components/download-button";
import { FavoriteButton } from "@/components/favorite-button";
import { SignupWall } from "@/components/signup-wall";
import { cdnUrl } from "@/lib/cdn";
import type { Viewer } from "@/lib/entitlements";
import { PIN_LABEL_COPY } from "@/lib/labels";
import type { PublicClip } from "@/lib/queries";

const SOUND_KEY = "vbpov-sound";
const VIDEO_WINDOW = 2;

function writeSoundPref(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore quota / private mode */
  }
}

function storedSoundPref() {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

function userHasGestured() {
  return Boolean(navigator.userActivation?.hasBeenActive || navigator.userActivation?.isActive);
}

function markReady(video: HTMLVideoElement) {
  video.classList.add("is-ready");
}

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
  const startIndex = Math.max(0, clips.findIndex((clip) => clip.id === startId));
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [soundOn, setSoundOn] = useState(false);
  const [watchState, setWatchState] = useState<{ clipId: string; blocked: boolean } | null>(
    null,
  );
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const activeIndexRef = useRef(startIndex);
  const soundOnRef = useRef(false);

  const active = clips[activeIndex];

  const syncUrl = useCallback(
    (clipId: string) => {
      const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
      const next = `/games/${gameId}/watch/${clipId}${query}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== next) {
        window.history.replaceState(window.history.state, "", next);
      }
    },
    [gameId, tag],
  );

  const applySound = useCallback((video: HTMLVideoElement, wantSound: boolean) => {
    if (!wantSound) {
      video.muted = true;
      return video.play().catch(() => undefined);
    }
    video.muted = false;
    return video.play().catch(() => {
      video.muted = true;
      return video.play().catch(() => undefined);
    });
  }, []);

  const playActive = useCallback(
    (index: number) => {
      videos.current.forEach((video, videoIndex) => {
        if (!video) return;
        if (videoIndex === index) {
          const wantSound =
            soundOnRef.current || (userHasGestured() && storedSoundPref());
          if (wantSound) {
            soundOnRef.current = true;
          }
          void applySound(video, wantSound);
        } else {
          video.pause();
        }
      });
    },
    [applySound],
  );

  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const slide = root.children[startIndex] as HTMLElement | undefined;
    if (slide) {
      root.scrollTop = slide.offsetTop;
    }
  }, [startIndex]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.index);
        if (!Number.isFinite(index)) return;
        if (activeIndexRef.current === index) {
          return;
        }
        activeIndexRef.current = index;
        playActive(index);
        if (soundOnRef.current) {
          setSoundOn(true);
        }
        const clip = clips[index];
        if (clip) {
          syncUrl(clip.id);
        }
        setActiveIndex(index);
      },
      { root, threshold: [0.55, 0.9] },
    );

    for (const child of Array.from(root.children)) {
      observer.observe(child);
    }
    playActive(activeIndexRef.current);
    return () => observer.disconnect();
  }, [clips, playActive, syncUrl]);

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

  function setSound(next: boolean) {
    soundOnRef.current = next;
    setSoundOn(next);
    writeSoundPref(next);
    const video = videos.current[activeIndexRef.current];
    if (!video) return;
    if (next) {
      video.muted = false;
      void video.play().catch(() => {
        video.muted = true;
        soundOnRef.current = false;
        setSoundOn(false);
      });
      return;
    }
    video.muted = true;
  }

  function onSlideClick() {
    if (!soundOnRef.current) {
      setSound(true);
    }
  }

  if (clips.length === 0 || !active) {
    return (
      <div className="feed-root grid place-items-center px-4">
        <p className="text-sm text-muted">No clips in this filter.</p>
        <Link href={closeHref} className="btn btn-ghost mt-4">
          Back to the session
        </Link>
      </div>
    );
  }

  return (
    <div className="feed-root">
      <div ref={scroller} className="feed-scroller">
        {clips.map((clip, index) => {
          const playback = cdnUrl(clip.playbackKey);
          const poster = cdnUrl(clip.posterKey);
          const mounted = Math.abs(index - activeIndex) <= VIDEO_WINDOW;

          return (
            <section
              key={clip.id}
              data-index={index}
              className="feed-slide"
              onClick={onSlideClick}
            >
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="feed-poster" />
              ) : null}
              {mounted && playback ? (
                <video
                  ref={(node) => {
                    videos.current[index] = node;
                  }}
                  className="feed-video"
                  src={playback}
                  poster={poster || undefined}
                  playsInline
                  muted
                  loop
                  preload="auto"
                  disableRemotePlayback
                  controls={false}
                  onCanPlay={(event) => markReady(event.currentTarget)}
                  onPlaying={(event) => markReady(event.currentTarget)}
                />
              ) : null}
              {!playback && !poster ? (
                <div className="grid h-full place-items-center text-sm text-muted">
                  Playback not available
                </div>
              ) : null}
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
          <button
            type="button"
            className="icon-btn"
            aria-pressed={soundOn}
            aria-label={soundOn ? "Mute" : "Unmute"}
            onClick={(event) => {
              event.stopPropagation();
              setSound(!soundOnRef.current);
            }}
          >
            <SoundIcon on={soundOn} />
          </button>
        </div>
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

      {!soundOn && !blocked ? (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-5 left-4 z-(--z-raised) chip"
          onClick={() => setSound(true)}
        >
          Sound is off
        </button>
      ) : viewer.downloadsRemaining !== null && viewer.canDownload ? (
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

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M4 10v4h3l5 4V6L7 10H4z"
        fill="currentColor"
      />
      {on ? (
        <path
          d="M16 8.5c1.4 1.2 1.4 5.8 0 7M18.5 6c2.4 2.2 2.4 9.8 0 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16 10l5 5m0-5-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
