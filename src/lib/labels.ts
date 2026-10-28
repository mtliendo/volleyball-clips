import type { ClipStatus, GameType, PinLabel } from "./db/schema";
import { PIN_LABELS } from "./db/schema";

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

export const PIN_LABEL_COPY: Record<PinLabel, string> = {
  longest_rally: "Longest rally",
  best_dig: "Best dig",
  super_spike: "Super spike",
};

export { PIN_LABELS };

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
