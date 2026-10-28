/** Client-safe playback grant types. Signing stays in `cloudfront-sign.ts`. */

/** Long enough for a normal feed session; the client refreshes before this. */
export const SIGNED_PLAYBACK_TTL_SECONDS = 2 * 60 * 60;

/** Re-issue a grant this far before expiry so a mid-feed signature never 403s. */
export const SIGNED_PLAYBACK_REFRESH_SECONDS = 10 * 60;

export type PlaybackGrant = {
  clipId: string;
  playbackUrl: string;
  expiresAt: number;
};

export function isPlaybackGrantFresh(
  grant: PlaybackGrant | undefined,
  now = Date.now(),
): grant is PlaybackGrant {
  return Boolean(grant && grant.expiresAt > now + 5_000);
}

export function isPlaybackGrantStale(
  grant: PlaybackGrant | undefined,
  now = Date.now(),
) {
  if (!grant) return true;
  return now >= grant.expiresAt - SIGNED_PLAYBACK_REFRESH_SECONDS * 1000;
}

export function playbackRefreshDelayMs(
  grant: PlaybackGrant,
  now = Date.now(),
) {
  return Math.max(
    5_000,
    grant.expiresAt - SIGNED_PLAYBACK_REFRESH_SECONDS * 1000 - now,
  );
}
