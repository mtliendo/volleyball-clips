"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DownloadButton } from "@/components/download-button";
import { DownloadLimitWall } from "@/components/download-limit-wall";
import { FavoriteButton } from "@/components/favorite-button";
import { FeedTagSheet, type CatalogTag } from "@/components/feed-tag-sheet";
import { SignupWall } from "@/components/signup-wall";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { cdnUrl } from "@/lib/cdn";
import { mergeUtmIntoPath } from "@/lib/utm";
import type { PinLabel } from "@/lib/db/schema";
import type { Viewer } from "@/lib/entitlements";
import { PIN_LABEL_COPY } from "@/lib/labels";
import {
  isPlaybackGrantFresh,
  isPlaybackGrantStale,
  playbackRefreshDelayMs,
  type PlaybackGrant,
} from "@/lib/playback";
import type { ClipPin, PublicClip } from "@/lib/queries";

const SOUND_KEY = "vbpov-sound";
const SWIPE_HINT_KEY = "vbpov-swipe-hint";
const SWIPE_HINT_MS = 4000;
const PRELOAD_WINDOW = 1;
const CLIP_VIEW_THROTTLE_MS = 500;

function writeSoundPref(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore quota / private mode */
  }
}

function swipeHintSeen() {
  try {
    return window.localStorage.getItem(SWIPE_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSwipeHintSeen() {
  try {
    window.localStorage.setItem(SWIPE_HINT_KEY, "1");
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
  try {
    player.disableRemotePlayback = true;
  } catch {
    /* older WebKit */
  }
  player.setAttribute("data-feed-player", "true");
  applyMute(player, true);
  return player;
}

function warmedSrc(slide: HTMLElement | null, fallback: string) {
  if (!slide) return fallback;
  const preload = slide.querySelector<HTMLVideoElement>("video.feed-preload");
  return preload?.currentSrc || preload?.src || fallback;
}

function pinSeed(clips: PublicClip[]) {
  return Object.fromEntries(clips.map((clip) => [clip.id, clip.pin])) as Record<
    string,
    ClipPin | null
  >;
}

function tagSeed(clips: PublicClip[]) {
  return Object.fromEntries(clips.map((clip) => [clip.id, clip.tags])) as Record<
    string,
    PublicClip["tags"]
  >;
}

function pinKey(clips: PublicClip[]) {
  return clips
    .map((clip) => `${clip.id}:${clip.pin?.label ?? ""}:${clip.pin?.position ?? ""}`)
    .join(",");
}

function playTagKey(clips: PublicClip[]) {
  return clips
    .map((clip) => `${clip.id}:${clip.tags.map((tag) => tag.slug).sort().join("+")}`)
    .join(",");
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function keyDelta(key: string) {
  if (key === "ArrowDown" || key === "PageDown" || key === "j" || key === "J") {
    return 1;
  }
  if (key === "ArrowUp" || key === "PageUp" || key === "k" || key === "K") {
    return -1;
  }
  return 0;
}

function neighborClipIds(clips: PublicClip[], index: number) {
  return [index - 1, index + 1]
    .map((item) => clips[item]?.id)
    .filter((id): id is string => Boolean(id));
}

function mergePlaybackGrants(
  current: Record<string, PlaybackGrant>,
  incoming: PlaybackGrant[],
) {
  if (incoming.length === 0) return current;
  const next = { ...current };
  let changed = false;
  for (const grant of incoming) {
    const prev = next[grant.clipId];
    // Keep a still-fresh URL so a /api/watch refresh does not reload the player.
    if (!prev || isPlaybackGrantStale(prev)) {
      next[grant.clipId] = grant;
      changed = true;
    }
  }
  return changed ? next : current;
}

export function VerticalFeed({
  clips,
  startId,
  gameId,
  tag,
  catalogTags = [],
  viewer,
  closeHref,
  forceWall = null,
  initialPlayback = {},
  requireSignedPlayback = false,
}: {
  clips: PublicClip[];
  startId: string;
  gameId: string;
  tag: string | null;
  catalogTags?: CatalogTag[];
  viewer: Viewer;
  closeHref: string;
  forceWall?: "watch" | "download" | null;
  initialPlayback?: Record<string, PlaybackGrant>;
  requireSignedPlayback?: boolean;
}) {
  const startIndex = Math.max(0, clips.findIndex((clip) => clip.id === startId));
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [soundOn, setSoundOn] = useState(false);
  const [watchState, setWatchState] = useState<{ clipId: string; blocked: boolean } | null>(
    null,
  );
  const serverFavKey = clips.map((clip) => `${clip.id}:${clip.favorited ? 1 : 0}`).join(",");
  const [favoritedIds, setFavoritedIds] = useState(
    () => new Set(clips.filter((clip) => clip.favorited).map((clip) => clip.id)),
  );
  const [seededFavKey, setSeededFavKey] = useState(serverFavKey);
  if (seededFavKey !== serverFavKey) {
    setSeededFavKey(serverFavKey);
    setFavoritedIds(new Set(clips.filter((clip) => clip.favorited).map((clip) => clip.id)));
  }
  const serverPinKey = pinKey(clips);
  const [pinsByClip, setPinsByClip] = useState(() => pinSeed(clips));
  const [seededPinKey, setSeededPinKey] = useState(serverPinKey);
  if (seededPinKey !== serverPinKey) {
    setSeededPinKey(serverPinKey);
    setPinsByClip(pinSeed(clips));
  }
  const serverTagKey = playTagKey(clips);
  const [tagsByClip, setTagsByClip] = useState(() => tagSeed(clips));
  const [seededTagKey, setSeededTagKey] = useState(serverTagKey);
  if (seededTagKey !== serverTagKey) {
    setSeededTagKey(serverTagKey);
    setTagsByClip(tagSeed(clips));
  }
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [downloadsRemaining, setDownloadsRemaining] = useState(viewer.downloadsRemaining);
  const [downloadLimit, setDownloadLimit] = useState<{ nextAt: string | null } | null>(() =>
    forceWall === "download" ? { nextAt: viewer.nextDownloadAt } : null,
  );
  const [tagPending, setTagPending] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLElement | null)[]>([]);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const activeIndexRef = useRef(startIndex);
  const unlockedRef = useRef(false);
  const userMutedRef = useRef(false);
  const clipsRef = useRef(clips);
  const playGenRef = useRef(0);
  const playIndexRef = useRef<(index: number) => void>(() => undefined);
  const requireSignedRef = useRef(requireSignedPlayback);
  const [playbackById, setPlaybackById] = useState(initialPlayback);
  const playbackByIdRef = useRef(playbackById);
  const [watchNonce, setWatchNonce] = useState(0);
  const errorRetriesRef = useRef<Record<string, number>>({});

  const active = clips[activeIndex];
  const blocked =
    forceWall === "watch" ||
    (!viewer.watchUnlimited &&
      Boolean(active) &&
      watchState?.clipId === active?.id &&
      watchState.blocked);
  const showHint =
    hintVisible && clips.length >= 2 && !blocked && !downloadLimit && !tagSheetOpen;

  const srcForClip = useCallback((clip: PublicClip | undefined) => {
    if (!clip) return "";
    const grant = playbackByIdRef.current[clip.id];
    if (isPlaybackGrantFresh(grant)) return grant.playbackUrl;
    if (requireSignedRef.current) return "";
    return cdnUrl(clip.playbackKey);
  }, []);

  const syncSoundUi = useCallback((player: HTMLVideoElement) => {
    setSoundOn(!player.muted);
  }, []);

  const attachPlayer = useCallback((index: number) => {
    const player = playerRef.current;
    const slide =
      slides.current[index] ??
      (scroller.current?.children[index] as HTMLElement | undefined);
    if (!player || !slide) return;
    if (player.parentElement !== slide) {
      slide.appendChild(player);
    }
  }, []);

  const playIndex = useCallback(
    (index: number) => {
      const player = playerRef.current;
      const clip = clipsRef.current[index];
      const fallback = srcForClip(clip);
      const src = warmedSrc(slides.current[index], fallback);
      if (!player) return;

      attachPlayer(index);
      if (!src || !player.parentElement) {
        return;
      }

      const gen = ++playGenRef.current;
      const wantSound = unlockedRef.current && !userMutedRef.current;
      const srcChanged = player.dataset.src !== src;
      const switchingClip = player.dataset.clipId !== clip?.id;
      const resumeTime = !switchingClip && srcChanged ? player.currentTime : 0;

      if (srcChanged) {
        player.classList.remove("is-ready");
        player.pause();
      }

      if (srcChanged) {
        player.poster = clip?.posterKey ? cdnUrl(clip.posterKey) : "";
        player.dataset.src = src;
        if (clip) player.dataset.clipId = clip.id;
        player.src = src;
        if (resumeTime > 0.05) {
          const onMeta = () => {
            if (gen !== playGenRef.current) return;
            player.currentTime = resumeTime;
            player.removeEventListener("loadedmetadata", onMeta);
          };
          player.addEventListener("loadedmetadata", onMeta);
        }
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
    [attachPlayer, srcForClip, syncSoundUi],
  );

  const syncUrl = useCallback(
    (clipId: string) => {
      const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
      const next = mergeUtmIntoPath(
        `/games/${gameId}/watch/${clipId}${query}`,
        window.location.search,
      );
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== next) {
        window.history.replaceState(window.history.state, "", next);
      }
    },
    [gameId, tag],
  );

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    writeSwipeHintSeen();
  }, []);

  useEffect(() => {
    if (clips.length < 2 || swipeHintSeen()) return;
    const timer = window.setTimeout(() => setHintVisible(true), 0);
    return () => window.clearTimeout(timer);
  }, [clips.length]);

  useLayoutEffect(() => {
    clipsRef.current = clips;
    playIndexRef.current = playIndex;
    requireSignedRef.current = requireSignedPlayback;
    playbackByIdRef.current = playbackById;
  }, [clips, playIndex, playbackById, requireSignedPlayback]);

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
    const onError = () => {
      const clip = clipsRef.current[activeIndexRef.current];
      if (!clip || !requireSignedRef.current) return;
      const tries = errorRetriesRef.current[clip.id] ?? 0;
      if (tries >= 2) return;
      errorRetriesRef.current[clip.id] = tries + 1;
      const next = { ...playbackByIdRef.current };
      delete next[clip.id];
      playbackByIdRef.current = next;
      setPlaybackById(next);
      setWatchNonce((value) => value + 1);
    };
    player.addEventListener("volumechange", onVolume);
    player.addEventListener("playing", onPlaying);
    player.addEventListener("waiting", onWaiting);
    player.addEventListener("loadedmetadata", onMeta);
    player.addEventListener("error", onError);

    const tryPlay = () => playIndexRef.current(activeIndexRef.current);
    tryPlay();
    const retry = window.requestAnimationFrame(tryPlay);

    return () => {
      window.cancelAnimationFrame(retry);
      player.removeEventListener("volumechange", onVolume);
      player.removeEventListener("playing", onPlaying);
      player.removeEventListener("waiting", onWaiting);
      player.removeEventListener("loadedmetadata", onMeta);
      player.removeEventListener("error", onError);
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
    playIndex(activeIndexRef.current);
    const current = clipsRef.current[activeIndexRef.current];
    if (current) {
      syncUrl(current.id);
    }
    return () => observer.disconnect();
  }, [clips, playIndex, syncUrl]);

  useEffect(() => {
    if (!active) return;
    const needsWatch = !viewer.watchUnlimited || requireSignedPlayback;
    if (!needsWatch) return;

    let cancelled = false;
    let refreshTimer = 0;
    const clipId = active.id;
    const preloadClipIds = neighborClipIds(
      clipsRef.current,
      activeIndexRef.current,
    ).filter((id) => id !== clipId);

    async function run() {
      const response = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ clipId, preloadClipIds }),
      });
      if (cancelled) return;

      const blocked = response.status === 403;
      if (blocked) {
        playerRef.current?.pause();
      }
      setWatchState({ clipId, blocked });
      if (blocked || !response.ok) return;

      const body = (await response.json().catch(() => ({}))) as {
        playback?: PlaybackGrant | null;
        preload?: PlaybackGrant[];
      };
      const incoming = [
        ...(body.playback ? [body.playback] : []),
        ...(Array.isArray(body.preload) ? body.preload : []),
      ];
      const merged = mergePlaybackGrants(playbackByIdRef.current, incoming);
      if (merged !== playbackByIdRef.current) {
        playbackByIdRef.current = merged;
        setPlaybackById(merged);
      }
      errorRetriesRef.current[clipId] = 0;
      playIndexRef.current(activeIndexRef.current);

      const grant = playbackByIdRef.current[clipId];
      if (grant && requireSignedPlayback) {
        refreshTimer = window.setTimeout(() => {
          if (!cancelled) void run();
        }, playbackRefreshDelayMs(grant));
      }
    }

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
    };
  }, [active, requireSignedPlayback, viewer.watchUnlimited, watchNonce]);

  const lastClipView = useRef({ id: "", at: 0 });
  useEffect(() => {
    if (!active) return;
    const clipId = active.id;
    if (clipId === lastClipView.current.id) return;

    const fire = () => {
      lastClipView.current = { id: clipId, at: Date.now() };
      trackEvent(ANALYTICS_EVENTS.clipView, { clip_id: clipId, game_id: gameId });
    };

    const wait = Math.max(0, CLIP_VIEW_THROTTLE_MS - (Date.now() - lastClipView.current.at));
    if (wait === 0) {
      fire();
      return;
    }
    const timer = window.setTimeout(fire, wait);
    return () => window.clearTimeout(timer);
  }, [active, gameId]);

  useEffect(() => {
    if (!showHint) return;

    const root = scroller.current?.parentElement;
    const timer = window.setTimeout(dismissHint, SWIPE_HINT_MS);
    const onDismiss = () => dismissHint();
    const onKey = (event: KeyboardEvent) => {
      if (keyDelta(event.key)) dismissHint();
    };

    root?.addEventListener("pointerdown", onDismiss);
    root?.addEventListener("wheel", onDismiss, { passive: true });
    root?.addEventListener("touchmove", onDismiss, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      root?.removeEventListener("pointerdown", onDismiss);
      root?.removeEventListener("wheel", onDismiss);
      root?.removeEventListener("touchmove", onDismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [dismissHint, showHint]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (tagSheetOpen || downloadLimit) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      const delta = keyDelta(event.key);
      if (!delta) return;

      event.preventDefault();
      const max = clipsRef.current.length - 1;
      const next = Math.min(max, Math.max(0, activeIndexRef.current + delta));
      if (next === activeIndexRef.current) return;

      const root = scroller.current;
      const slide =
        slides.current[next] ?? (root?.children[next] as HTMLElement | undefined);
      if (root && slide) {
        root.scrollTop = slide.offsetTop;
      }

      activeIndexRef.current = next;
      playIndex(next);
      const clip = clipsRef.current[next];
      if (clip) {
        syncUrl(clip.id);
      }
      setActiveIndex(next);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [downloadLimit, playIndex, syncUrl, tagSheetOpen]);

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

  function applyPinLocal(clipId: string, label: PinLabel | null) {
    setPinsByClip((prev) => {
      const next: Record<string, ClipPin | null> = { ...prev };
      if (!label) {
        next[clipId] = null;
        return next;
      }
      for (const [id, value] of Object.entries(next)) {
        if (value?.label === label && id !== clipId) {
          next[id] = null;
        }
      }
      next[clipId] = { label, position: next[clipId]?.position ?? 0 };
      return next;
    });
  }

  async function pickPin(label: PinLabel | null) {
    if (!active) return;
    const clipId = active.id;
    const snapshot = pinsByClip;
    applyPinLocal(clipId, label);
    setTagPending(true);
    try {
      const response = await fetch(`/api/admin/clips/${clipId}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!response.ok) {
        setPinsByClip(snapshot);
      }
    } catch {
      setPinsByClip(snapshot);
    }
    setTagPending(false);
  }

  async function togglePlayTag(tag: CatalogTag) {
    if (!active) return;
    const clipId = active.id;
    const current = tagsByClip[clipId] ?? active.tags;
    const has = current.some((item) => item.id === tag.id);
    const next = has ? current.filter((item) => item.id !== tag.id) : [...current, tag];
    setTagsByClip((prev) => ({ ...prev, [clipId]: next }));
    setTagPending(true);
    try {
      const response = await fetch(`/api/admin/clips/${clipId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: next.map((item) => item.id) }),
      });
      if (!response.ok) {
        setTagsByClip((prev) => ({ ...prev, [clipId]: current }));
      }
    } catch {
      setTagsByClip((prev) => ({ ...prev, [clipId]: current }));
    }
    setTagPending(false);
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

  const activePin = pinsByClip[active.id] ?? active.pin;
  const activePlayTags = tagsByClip[active.id] ?? active.tags;
  const pinCount = Object.values(pinsByClip).filter(Boolean).length;

  return (
    <div className="feed-root" data-active-clip={active.id}>
      <div ref={scroller} className="feed-scroller">
        {clips.map((clip, index) => {
          const grant = playbackById[clip.id];
          const playback = isPlaybackGrantFresh(grant)
            ? grant.playbackUrl
            : requireSignedPlayback
              ? ""
              : cdnUrl(clip.playbackKey);
          const poster = cdnUrl(clip.posterKey);
          const preload = Math.abs(index - activeIndex) <= PRELOAD_WINDOW && index !== activeIndex;

          return (
            <section
              key={clip.id}
              ref={(node) => {
                slides.current[index] = node;
                return () => {
                  if (slides.current[index] === node) {
                    slides.current[index] = null;
                  }
                };
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
        {activePin ? (
          <span className="chip-spark pointer-events-none" data-pin-badge={activePin.label ?? "pinned"}>
            {activePin.label ? PIN_LABEL_COPY[activePin.label] : "Pinned"}
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-3 bottom-20 z-(--z-raised) flex flex-col items-center gap-3">
        {viewer.isAdmin ? (
          <div className="pointer-events-auto">
            <button
              type="button"
              className="icon-btn"
              data-pin-control=""
              aria-pressed={Boolean(activePin) || activePlayTags.length > 0}
              aria-label="Set tags"
              onClick={(event) => {
                event.stopPropagation();
                setTagSheetOpen(true);
              }}
            >
              <TagIcon />
            </button>
          </div>
        ) : null}
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
            favorited={favoritedIds.has(active.id)}
            canFavorite={viewer.canFavorite}
            returnTo={`/games/${gameId}/watch/${active.id}`}
            onFavoritedChange={(clipId, next) => {
              setFavoritedIds((prev) => {
                const copy = new Set(prev);
                if (next) {
                  copy.add(clipId);
                } else {
                  copy.delete(clipId);
                }
                return copy;
              });
            }}
          />
        </div>
        <div className="pointer-events-auto">
          <DownloadButton
            clipId={active.id}
            canDownload={viewer.canDownload}
            isPro={viewer.isPro}
            remaining={downloadsRemaining}
            returnTo={`/games/${gameId}/watch/${active.id}`}
            compact
            nextDownloadAt={viewer.nextDownloadAt}
            startLimitOpen={forceWall === "download"}
            onRemainingChange={setDownloadsRemaining}
            onLimit={(info) => setDownloadLimit(info)}
          />
        </div>
      </div>

      {!soundOn && !blocked && !downloadLimit ? (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-5 left-4 z-(--z-raised) chip"
          onClick={() => setSound(true)}
        >
          Sound is off
        </button>
      ) : null}

      {showHint ? <FeedSwipeHint /> : null}

      {blocked ? (
        <div className="absolute inset-0 z-(--z-modal)">
          <SignupWall returnTo={`/games/${gameId}/watch/${active.id}`} />
        </div>
      ) : null}

      {downloadLimit ? (
        <div className="absolute inset-0 z-(--z-modal)">
          <DownloadLimitWall nextAt={downloadLimit.nextAt} onBack={() => setDownloadLimit(null)} />
        </div>
      ) : null}

      {viewer.isAdmin ? (
        <FeedTagSheet
          open={tagSheetOpen}
          clipId={active.id}
          pin={activePin}
          pinsByClip={pinsByClip}
          playTags={activePlayTags}
          catalogTags={catalogTags}
          pinCount={pinCount}
          pending={tagPending}
          onClose={() => setTagSheetOpen(false)}
          onPickPin={(label) => void pickPin(label)}
          onTogglePlayTag={(item) => void togglePlayTag(item)}
        />
      ) : null}
    </div>
  );
}

function FeedSwipeHint() {
  // Keyboard arrows already move the feed, but nothing on screen says so.
  // Fine pointers get scroll/keys copy via CSS; coarse pointers get swipe.
  return (
    <div
      className="feed-swipe-hint"
      data-swipe-hint=""
      role="status"
      aria-live="polite"
    >
      <span className="feed-swipe-hint-mark" aria-hidden="true">
        <SwipeHintIcon />
      </span>
      <p className="feed-swipe-hint-copy feed-swipe-hint-copy-coarse">
        Swipe up for the next clip
      </p>
      <p className="feed-swipe-hint-copy feed-swipe-hint-copy-fine">
        Scroll or use the arrow keys
      </p>
    </div>
  );
}

function SwipeHintIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M7 13.5 12 8.5 17 13.5M7 18 12 13 17 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M4 10.5 10.5 4h7.2L20 6.3v7.2L13.5 20 4 10.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="15.2" cy="8.8" r="1.15" fill="currentColor" />
    </svg>
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
