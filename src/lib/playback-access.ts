import "server-only";

import {
  isCloudFrontSigningConfigured,
  playbackWatchUrl,
} from "./cloudfront-sign";
import {
  SIGNED_PLAYBACK_TTL_SECONDS,
  type PlaybackGrant,
} from "./playback";
import type { PublicClip } from "./queries";

export function makePlaybackGrant(
  clipId: string,
  playbackKey: string | null | undefined,
): PlaybackGrant | null {
  if (!playbackKey) return null;
  try {
    return {
      clipId,
      playbackUrl: playbackWatchUrl(playbackKey),
      expiresAt: Date.now() + SIGNED_PLAYBACK_TTL_SECONDS * 1000,
    };
  } catch {
    return null;
  }
}

export function isPlaybackSigningEnabled() {
  return isCloudFrontSigningConfigured();
}

/** Start clip plus neighbors so signed-in autoplay and preload do not wait on /api/watch. */
export function initialFeedPlayback(
  clips: Pick<PublicClip, "id" | "playbackKey">[],
  startId: string,
): Record<string, PlaybackGrant> {
  if (!isPlaybackSigningEnabled()) return {};

  const start = Math.max(
    0,
    clips.findIndex((clip) => clip.id === startId),
  );
  const out: Record<string, PlaybackGrant> = {};
  for (const index of [start - 1, start, start + 1]) {
    const clip = clips[index];
    if (!clip) continue;
    const grant = makePlaybackGrant(clip.id, clip.playbackKey);
    if (grant) out[grant.clipId] = grant;
  }
  return out;
}
