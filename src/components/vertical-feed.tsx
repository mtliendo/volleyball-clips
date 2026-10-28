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
const PRELOAD_WINDOW = 1;

function writeSoundPref(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore quota / private mode */
  }
}

function applyMute(player: HTMLVideoElement, muted: boolean) {
  player.muted = muted;
  player.defaultMuted = muted;
  if (muted) {
    player.setAttribute("muted", "");
  } else {
    player.removeAttribute("muted");
  }
}

function createPlayer() {
  const player = document.createElement("video");
  player.className = "feed-player";
  player.playsInline = true;
  player.setAttribute("playsinline", "");
  player.setAttribute("webkit-playsinline", "");
  player.loop = true;
  player.preload = "auto";
  player.controls = false;
  player.disableRemotePlayback = true;
  player.setAttribute("data-feed-player", "true");
  applyMute(player, true);
  return player;
}

function warmedSrc(slide: HTMLElement | null, fallback: string) {
  if (!slide) return fallback;
  const preload = slide.querySelector<HTMLVideoElement>("video.feed-preload");
  return preload?.currentSrc || preload?.src || fallback;
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
  const slides = useRef<(HTMLElement | null)[]>([]);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const activeIndexRef = useRef(startIndex);
  const unlockedRef = useRef(false);
  const userMutedRef = useRef(false);
  const clipsRef = useRef(clips);
  const playGenRef = useRef(0);
  const playIndexRef = useRef<(index: number) => void>(() => undefined);

  const active = clips[activeIndex];

  const syncSoundUi = useCallback((player: HTMLVideoElement) => {
    setSoundOn(!player.muted);
  }, []);

  const attachPlayer = useCallback((index: number) => {
    const player = playerRef.current;
    const slide = slides.current[index];
    if (!player || !slide) return;
    if (player.parentElement !== slide) {
      slide.appendChild(player);
    }
  }, []);

  const playIndex = useCallback(
    (index: number) => {
      const player = playerRef.current;
      const clip = clipsRef.current[index];
      const fallback = clip ? cdnUrl(clip.playbackKey) : "";
      const src = warmedSrc(slides.current[index], fallback);
      if (!player || !src) return;

      const gen = ++playGenRef.current;
      const wantSound = unlockedRef.current && !userMutedRef.current;
      const srcChanged = player.dataset.src !== src;

      if (srcChanged) {
        player.classList.remove("is-ready");
        player.pause();
      }

      attachPlayer(index);

      if (srcChanged) {
        player.poster = clip?.posterKey ? cdnUrl(clip.posterKey) : "";
        player.dataset.src = src;
        player.src = src;
      }

      // Same unlocked element: never fall back to muted after the user tap.
      applyMute(player, !wantSound);
      void player
        .play()
        .then(() => {
          if (gen !== playGenRef.current) return;
          syncSoundUi(player);
        })
        .catch(() => {
          if (gen !== playGenRef.current) return;
          syncSoundUi(player);
        });
    },
    [attachPlayer, syncSoundUi],
  );

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

  useLayoutEffect(() => {
    clipsRef.current = clips;
    playIndexRef.current = playIndex;
  }, [clips, playIndex]);

  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const slide = root.children[startIndex] as HTMLElement | undefined;
    if (slide) {
      root.scrollTop = slide.offsetTop;
    }
  }, [startIndex]);

  useLayoutEffect(() => {
    const player = createPlayer();
    playerRef.current = player;

    const onVolume = () => syncSoundUi(player);
    const onPlaying = () => {
      player.classList.add("is-ready");
      syncSoundUi(player);
    };
    const onWaiting = () => {
      player.classList.remove("is-ready");
    };
    const onMeta = () => {
      const wantSound = unlockedRef.current && !userMutedRef.current;
      applyMute(player, !wantSound);
      syncSoundUi(player);
    };
    player.addEventListener("volumechange", onVolume);
    player.addEventListener("playing", onPlaying);
    player.addEventListener("waiting", onWaiting);
    player.addEventListener("loadedmetadata", onMeta);

    playIndexRef.current(activeIndexRef.current);

    return () => {
      player.removeEventListener("volumechange", onVolume);
      player.removeEventListener("playing", onPlaying);
      player.removeEventListener("waiting", onWaiting);
      player.removeEventListener("loadedmetadata", onMeta);
      player.remove();
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
    // One media element for the life of the feed. Recreating it drops iOS unlock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        if (!Number.isFinite(index) || activeIndexRef.current === index) {
          return;
        }
        activeIndexRef.current = index;
        playIndex(index);
        const clip = clipsRef.current[index];
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
    return () => observer.disconnect();
  }, [clips, playIndex, syncUrl]);

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
        playerRef.current?.pause();
      }
      setWatchState({ clipId: active.id, blocked });
    });

    return () => {
      cancelled = true;
    };
  }, [active, viewer.watchUnlimited]);

  const blocked =
    !viewer.watchUnlimited &&
    Boolean(active) &&
    watchState?.clipId === active?.id &&
    watchState.blocked;

  function setSound(next: boolean) {
    const player = playerRef.current;
    userMutedRef.current = !next;
    if (next) {
      unlockedRef.current = true;
    }
    writeSoundPref(next);
    if (!player) {
      setSoundOn(false);
      return;
    }
    applyMute(player, !next);
    if (next) {
      void player.play().finally(() => syncSoundUi(player));
      return;
    }
    syncSoundUi(player);
  }

  function onSlideClick() {
    const player = playerRef.current;
    if (player?.muted) {
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
          const preload = Math.abs(index - activeIndex) <= PRELOAD_WINDOW && index !== activeIndex;

          return (
            <section
              key={clip.id}
              ref={(node) => {
                slides.current[index] = node;
              }}
              data-index={index}
              className="feed-slide"
              onClick={onSlideClick}
            >
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="feed-poster" />
              ) : null}
              {preload && playback ? (
                <video
                  className="feed-preload"
                  src={playback}
                  poster={poster || undefined}
                  muted
                  playsInline
                  loop
                  preload="auto"
                  disableRemotePlayback
                  controls={false}
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
            data-sound-control=""
            aria-pressed={soundOn}
            aria-label={soundOn ? "Mute" : "Unmute"}
            onClick={(event) => {
              event.stopPropagation();
              const player = playerRef.current;
              setSound(player ? player.muted : !soundOn);
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
