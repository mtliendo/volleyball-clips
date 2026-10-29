export const DOWNLOADS_REMAINING_HEADER = "X-Downloads-Remaining";
export const VERIFY_DOWNLOADS_COOKIE = "vb_verify_downloads";
const RECENT_DOWNLOAD_MS = 2 * 60 * 1000;
const FILENAME_MAX = 120;

export function recentDownloadWindowMs() {
  return RECENT_DOWNLOAD_MS;
}

export function sanitizeDownloadFilename(name: string) {
  const trimmed = name.trim() || "clip";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, FILENAME_MAX);
  return safe || "clip";
}

function splitNameAndExt(name: string) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return { stem: name, ext: "" };
  }
  return { stem: name.slice(0, lastDot), ext: name.slice(lastDot + 1) };
}

function withServedExtension(stem: string, ext: string) {
  const safeStem = sanitizeDownloadFilename(stem);
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
  if (!safeExt) {
    return safeStem.slice(0, FILENAME_MAX);
  }
  const suffix = `.${safeExt}`;
  return `${safeStem.slice(0, Math.max(1, FILENAME_MAX - suffix.length))}${suffix}`;
}

export function downloadFilename(input: {
  id: string;
  originalKey: string;
  quality: "playback" | "original";
}) {
  const raw = input.originalKey.split("/").pop()?.trim() || "";
  const { stem, ext } = splitNameAndExt(raw);
  const fallback = input.id.replace(/-/g, "").slice(0, 8) || "clip";
  const usedStem = stem || fallback;
  const servedExt = input.quality === "original" ? ext : "mp4";
  return withServedExtension(usedStem, servedExt);
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
