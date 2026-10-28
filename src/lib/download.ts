export const DOWNLOADS_REMAINING_HEADER = "X-Downloads-Remaining";
export const VERIFY_DOWNLOADS_COOKIE = "vb_verify_downloads";
const RECENT_DOWNLOAD_MS = 2 * 60 * 1000;

export function recentDownloadWindowMs() {
  return RECENT_DOWNLOAD_MS;
}

export function sanitizeDownloadFilename(name: string) {
  const trimmed = name.trim() || "clip.mp4";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
  return safe.endsWith(".mp4") ? safe : `${safe || "clip"}.mp4`;
}

export function downloadFilename(input: {
  id: string;
  originalKey: string;
  quality: "playback" | "original";
}) {
  if (input.quality === "original") {
    const raw = input.originalKey.split("/").pop() || "original.mp4";
    return sanitizeDownloadFilename(raw);
  }

  const shortId = input.id.replace(/-/g, "").slice(0, 8) || "clip";
  return `vbpov-1080p-${shortId}.mp4`;
}

export function contentDispositionAttachment(filename: string) {
  const safe = sanitizeDownloadFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export function filenameFromContentDisposition(header: string | null) {
  if (!header) return null;

  const encoded = header.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      /* use the plain filename */
    }
  }

  const quoted = header.match(/filename\s*=\s*"([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];

  const plain = header.match(/filename\s*=\s*([^;]+)/i);
  return plain?.[1]?.trim().replace(/^["']|["']$/g, "") || null;
}
