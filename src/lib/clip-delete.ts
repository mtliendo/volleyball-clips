export const ADMIN_CLIP_DELETE_METHOD = "DELETE" as const;

export function adminClipDeletePath(clipId: string) {
  return `/api/admin/clips/${clipId}`;
}

export type ClipDeleteFailure = {
  ok: false;
  status: number;
  error: string;
};

export type ClipDeleteSuccess = { ok: true };

export type ClipDeleteResult = ClipDeleteSuccess | ClipDeleteFailure;

export function clipDeleteErrorMessage(data: { error?: unknown }, fallback = "Could not delete clip") {
  return typeof data.error === "string" && data.error.trim() ? data.error : fallback;
}

export async function requestAdminClipDelete(
  clipId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClipDeleteResult> {
  try {
    const response = await fetchImpl(adminClipDeletePath(clipId), {
      method: ADMIN_CLIP_DELETE_METHOD,
      credentials: "same-origin",
    });
    const data = (await response.json().catch(() => ({}))) as { error?: unknown };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: clipDeleteErrorMessage(data),
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 0, error: "Could not delete clip" };
  }
}

export function removeClipAndSelectNext<T extends { id: string }>(
  clips: T[],
  deletedId: string,
): { clips: T[]; next: T | null; nextIndex: number } {
  const index = clips.findIndex((clip) => clip.id === deletedId);
  const remaining = clips.filter((clip) => clip.id !== deletedId);
  if (remaining.length === 0) {
    return { clips: remaining, next: null, nextIndex: -1 };
  }
  if (index === -1) {
    return { clips: remaining, next: remaining[0], nextIndex: 0 };
  }
  const nextIndex = Math.min(index, remaining.length - 1);
  return { clips: remaining, next: remaining[nextIndex], nextIndex };
}

export function clipDeleteIdentity(clip: {
  tags: { name: string }[];
  durationMs?: number | null;
  pin?: { label?: string | null } | null;
  durationLabel?: string;
}): { tags: string; details: string } {
  const tags = clip.tags.map((tag) => tag.name).filter(Boolean).join(", ") || "Untagged";
  const parts = [tags];
  if (clip.durationLabel) {
    parts.push(clip.durationLabel);
  }
  if (clip.pin?.label) {
    parts.push(clip.pin.label.replace(/_/g, " "));
  }
  return { tags, details: parts.join(" · ") };
}
