import type { ClipStatus, GameType } from "./db/schema";

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  open_gym: "Open gym",
  league: "League",
  tournament: "Tournament",
};

export const CLIP_STATUS_LABELS: Record<ClipStatus, string> = {
  uploading: "Uploading",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
