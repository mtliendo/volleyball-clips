import "server-only";

import { VERIFY_DOWNLOADS_COOKIE } from "./download";
import type { Viewer } from "./entitlements";
import type { PublicClip } from "./queries";

export { VERIFY_DOWNLOADS_COOKIE };

export const VERIFY_GAME_ID = "11111111-1111-4111-8111-111111111111";
export const VERIFY_CLIP_IDS = [
  "22222222-2222-4222-8222-222222222221",
  "22222222-2222-4222-8222-222222222222",
  "22222222-2222-4222-8222-222222222223",
] as const;

export function verifyViewer(overrides: Partial<Viewer> = {}): Viewer {
  return {
    signedIn: true,
    isAdmin: false,
    isPro: false,
    watchUnlimited: true,
    canFavorite: true,
    canDownload: true,
    downloadsRemaining: 3,
    nextDownloadAt: null,
    stripeReady: false,
    authReady: true,
    email: "verify@vbpov.test",
    name: "Verify",
    appUserId: "33333333-3333-4333-8333-333333333333",
    ...overrides,
  };
}

export function verifyClips(): PublicClip[] {
  const createdAt = new Date("2026-10-10T18:00:00.000Z");
  return VERIFY_CLIP_IDS.map((id, index) => ({
    id,
    gameId: VERIFY_GAME_ID,
    originalKey: `uploads/${VERIFY_GAME_ID}/${id}/clip.mp4`,
    playbackKey: `playback/${VERIFY_GAME_ID}/${id}/playback.mp4`,
    posterKey: null,
    durationMs: 8000,
    status: "ready",
    createdAt,
    tags: index === 0 ? [{ id: "tag-spike", slug: "spike", name: "Spike" }] : [],
    pin: null,
    favorited: false,
  }));
}

export function verifyCatalogTags() {
  return [
    { id: "tag-spike", slug: "spike", name: "Spike" },
    { id: "tag-dig", slug: "dig", name: "Dig" },
  ];
}
