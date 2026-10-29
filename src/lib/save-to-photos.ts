import { sanitizeDownloadFilename } from "./download";

export const SAVE_TO_PHOTOS_LABEL = "Save to Photos";
export const READY_TO_SAVE_STATUS = "Ready to save to Photos.";

export type ShareNavigatorLike = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  share?: unknown;
  canShare?: (data?: ShareData) => boolean;
};

export type ShareDebugSnapshot = {
  isIOSLike: boolean;
  share: string;
  canShare: string;
  mode: "photos" | "file";
};

function makeTestVideoFile() {
  return new File(["t"], "t.mp4", { type: "video/mp4" });
}

export function isIOSLike(nav: ShareNavigatorLike) {
  const ua = nav.userAgent ?? "";
  if (/iPad|iPhone|iPod/.test(ua)) {
    return true;
  }

  // iPadOS 13+ can send a desktop Mac Safari UA while still being a tablet.
  const macintosh =
    /Macintosh/.test(ua) || nav.platform === "MacIntel" || nav.platform === "MacPPC";
  return macintosh && (nav.maxTouchPoints ?? 0) > 1;
}

export function hasShareFunction(share: unknown) {
  return typeof share === "function";
}

export function canShareFiles(canShare?: ShareNavigatorLike["canShare"]) {
  if (typeof File === "undefined" || typeof canShare !== "function") {
    return false;
  }

  try {
    return canShare({ files: [makeTestVideoFile()] }) === true;
  } catch {
    return false;
  }
}

export function canSharePreparedFile(
  canShare: ShareNavigatorLike["canShare"] | undefined,
  file: File,
) {
  if (typeof canShare !== "function") {
    return true;
  }

  try {
    return canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

/**
 * Gate the two-tap Photos path on iOS + navigator.share only.
 * A 1-byte canShare({ files: [File] }) probe is unreliable on real iOS Safari
 * and was sending users down the attachment-download fallback.
 */
export function shouldUsePhotosShare(nav: ShareNavigatorLike) {
  return isIOSLike(nav) && hasShareFunction(nav.share);
}

export function downloadShareMimeType(filename: string, contentType?: string | null) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "mov") {
    return "video/quicktime";
  }
  if (ext === "mp4") {
    return "video/mp4";
  }

  const mime = contentType?.split(";")[0]?.trim();
  if (mime && mime !== "application/octet-stream") {
    return mime;
  }

  return "video/mp4";
}

export function downloadShareFilename(filename: string) {
  return sanitizeDownloadFilename(filename);
}

export function isShareAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function progressPercent(loaded: number, total: number | null) {
  if (total == null || total <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

export function preparingDownloadLabel(percent: number | null) {
  return percent == null ? "Preparing download..." : `Preparing ${percent}%...`;
}

export async function readResponseBlob(
  response: Response,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Blob> {
  const totalHeader = response.headers.get("content-length");
  const parsed = totalHeader ? Number(totalHeader) : NaN;
  const total = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const type = response.headers.get("content-type") || "application/octet-stream";

  if (!response.body) {
    const blob = await response.blob();
    onProgress?.(blob.size, total ?? blob.size);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }

  return new Blob(chunks as BlobPart[], { type });
}

export function createShareFile(blob: Blob, filename: string, contentType?: string | null) {
  const safeName = downloadShareFilename(filename);
  return new File([blob], safeName, {
    type: downloadShareMimeType(safeName, contentType || blob.type),
  });
}

function describeCanShare(canShare?: ShareNavigatorLike["canShare"]) {
  if (typeof canShare !== "function") {
    return "missing";
  }
  try {
    return canShareFiles(canShare) ? "true" : "false";
  } catch {
    return "threw";
  }
}

export function getShareDebugSnapshot(nav: ShareNavigatorLike): ShareDebugSnapshot {
  return {
    isIOSLike: isIOSLike(nav),
    share: typeof nav.share,
    canShare: describeCanShare(nav.canShare),
    mode: shouldUsePhotosShare(nav) ? "photos" : "file",
  };
}

export function isShareDebugQuery(search: string) {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("debug") === "share";
}
