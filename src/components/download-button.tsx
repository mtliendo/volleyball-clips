"use client";

import { Suspense, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLoginAnchor } from "@/components/auth-login-anchor";
import { DownloadLimitWall } from "@/components/download-limit-wall";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { DOWNLOADS_REMAINING_HEADER, filenameFromContentDisposition } from "@/lib/download";
import {
  READY_TO_SAVE_STATUS,
  SAVE_TO_PHOTOS_LABEL,
  canSharePreparedFile,
  createShareFile,
  downloadShareFilename,
  downloadShareMimeType,
  getShareDebugSnapshot,
  isShareAbortError,
  preparingDownloadLabel,
  progressPercent,
  readResponseBlob,
  shouldUsePhotosShare,
} from "@/lib/save-to-photos";

const PREPARING_LABEL = "Preparing download...";
const FAILED_LABEL = "Download failed. Try again.";

type PreparedDownload = {
  blob: Blob;
  filename: string;
  mimeType: string;
};

function subscribeNoop() {
  return () => {};
}

function usePhotosShare() {
  return useSyncExternalStore(
    subscribeNoop,
    () => shouldUsePhotosShare(navigator),
    () => false,
  );
}

function ShareDebugReadoutInner() {
  const params = useSearchParams();
  const enabled = params.get("debug") === "share";
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  if (!enabled || !mounted) {
    return null;
  }

  const snapshot = getShareDebugSnapshot(navigator);
  return (
    <p className="share-debug" data-share-debug="">
      iOS {snapshot.isIOSLike ? "yes" : "no"} · share {snapshot.share} · canShare {snapshot.canShare} ·
      mode {snapshot.mode}
    </p>
  );
}

export function ShareDebugReadout() {
  return (
    <Suspense fallback={null}>
      <ShareDebugReadoutInner />
    </Suspense>
  );
}

function triggerFileDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  return objectUrl;
}

type DownloadButtonProps = {
  clipId: string;
  canDownload: boolean;
  isPro: boolean;
  remaining: number | null;
  returnTo: string;
  compact?: boolean;
  quality?: "original" | "playback";
  nextDownloadAt?: string | null;
  startLimitOpen?: boolean;
  onRemainingChange?: (remaining: number | null) => void;
  onLimit?: (info: { nextAt: string | null }) => void;
};

export function DownloadButton({
  clipId,
  canDownload,
  compact = false,
  returnTo,
  ...props
}: DownloadButtonProps) {
  if (!canDownload) {
    return (
      <AuthLoginAnchor
        returnTo={returnTo}
        signup
        event={ANALYTICS_EVENTS.signupClick}
        className={compact ? "icon-btn" : "btn btn-ghost"}
        data-download-control=""
        data-clip-id={clipId}
        aria-label="Sign in to download"
      >
        {compact ? <DownloadIcon /> : "Sign in to download"}
      </AuthLoginAnchor>
    );
  }

  return (
    <AuthorizedDownloadButton
      key={clipId}
      clipId={clipId}
      compact={compact}
      returnTo={returnTo}
      {...props}
    />
  );
}

function AuthorizedDownloadButton({
  clipId,
  isPro,
  remaining,
  compact = false,
  quality,
  nextDownloadAt = null,
  startLimitOpen = false,
  onRemainingChange,
  onLimit,
}: Omit<DownloadButtonProps, "canDownload">) {
  const [limitOpen, setLimitOpen] = useState(startLimitOpen);
  const [limitNextAt, setLimitNextAt] = useState<string | null>(nextDownloadAt);
  const [localRemaining, setLocalRemaining] = useState(remaining);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [readyToSave, setReadyToSave] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const photosShare = usePhotosShare();
  const preparedRef = useRef<PreparedDownload | null>(null);
  const left = onRemainingChange ? remaining : localRemaining;
  const resolvedQuality = quality ?? (isPro ? "original" : "playback");

  function setLeft(next: number | null) {
    if (onRemainingChange) {
      onRemainingChange(next);
      return;
    }
    setLocalRemaining(next);
  }

  function showLimit(nextAt: string | null = nextDownloadAt) {
    trackEvent(ANALYTICS_EVENTS.downloadLimitHit);
    const at = nextAt ?? nextDownloadAt ?? null;
    setLimitNextAt(at);
    if (onLimit) {
      onLimit({ nextAt: at });
    } else {
      setLimitOpen(true);
    }
    if (left !== null) {
      setLeft(0);
    }
  }

  function fallbackDownload(prepared: PreparedDownload) {
    triggerFileDownload(prepared.blob, prepared.filename);
  }

  async function sharePrepared(prepared: PreparedDownload) {
    if (typeof navigator.share !== "function") {
      fallbackDownload(prepared);
      return;
    }

    try {
      const file = createShareFile(prepared.blob, prepared.filename, prepared.mimeType);
      if (!canSharePreparedFile(navigator.canShare?.bind(navigator), file)) {
        fallbackDownload(prepared);
        return;
      }
      await navigator.share({ files: [file] });
    } catch (error) {
      if (isShareAbortError(error)) {
        return;
      }
      fallbackDownload(prepared);
    }
  }

  async function prepareDownload() {
    if (pending) return;
    setFailed(false);

    if (!isPro && left === 0) {
      showLimit();
      return;
    }

    setPending(true);
    setPercent(null);
    setReadyToSave(false);
    try {
      const path =
        resolvedQuality === "playback"
          ? `/api/clips/${clipId}/download?quality=playback`
          : `/api/clips/${clipId}/download`;
      const response = await fetch(path);
      if (response.status === 402 || response.status === 403) {
        const payload = (await response.json().catch(() => null)) as { nextAt?: string | null } | null;
        showLimit(typeof payload?.nextAt === "string" ? payload.nextAt : null);
        return;
      }
      if (!response.ok) {
        setFailed(true);
        return;
      }

      const headerLeft = response.headers.get(DOWNLOADS_REMAINING_HEADER);
      if (headerLeft !== null && headerLeft !== "") {
        const next = Number(headerLeft);
        if (Number.isFinite(next)) {
          setLeft(next);
        }
      } else if (left !== null) {
        setLeft(Math.max(0, left - 1));
      }

      const blob = await readResponseBlob(response, (loaded, total) => {
        setPercent(progressPercent(loaded, total));
      });
      const filename = downloadShareFilename(
        filenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
          (resolvedQuality === "original" ? "vbpov-original.mp4" : "vbpov-1080p.mp4"),
      );
      const prepared = {
        blob,
        filename,
        mimeType: downloadShareMimeType(
          filename,
          blob.type || response.headers.get("content-type"),
        ),
      };
      preparedRef.current = prepared;

      if (shouldUsePhotosShare(navigator)) {
        setReadyToSave(true);
        return;
      }

      fallbackDownload(prepared);
      preparedRef.current = null;
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
      setPercent(null);
    }
  }

  function onClick() {
    if (pending) return;

    const prepared = preparedRef.current;
    if (readyToSave && prepared) {
      void sharePrepared(prepared);
      return;
    }

    void prepareDownload();
  }

  const preparingLabel = preparingDownloadLabel(percent);
  const idleLabel =
    resolvedQuality === "original"
      ? "Original"
      : left === null
        ? "1080p"
        : `${left} left`;
  const idleAria =
    resolvedQuality === "original"
      ? "Download original"
      : left === null
        ? "Download 1080p"
        : `Download 1080p, ${left} left this week`;
  const visibleLabel = pending
    ? preparingLabel
    : readyToSave
      ? SAVE_TO_PHOTOS_LABEL
      : compact
        ? idleLabel
        : `Download ${idleLabel}`;
  const ariaLabel = pending ? preparingLabel : readyToSave ? SAVE_TO_PHOTOS_LABEL : idleAria;
  const liveStatus = pending ? PREPARING_LABEL : readyToSave ? READY_TO_SAVE_STATUS : failed ? FAILED_LABEL : "";

  const className = [
    compact ? "icon-btn download-ctrl" : "btn btn-ghost",
    pending ? "is-preparing" : "",
    readyToSave ? "is-ready-to-save" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className={className}
        data-download-control=""
        data-clip-id={clipId}
        data-download-quality={resolvedQuality}
        data-download-remaining={left === null ? undefined : String(left)}
        data-download-pending={pending ? "true" : undefined}
        data-download-mode={photosShare ? "photos" : "file"}
        data-save-to-photos={readyToSave ? "ready" : undefined}
        data-download-progress={pending && percent != null ? String(percent) : undefined}
        aria-label={ariaLabel}
        aria-busy={pending}
        aria-disabled={pending}
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
      >
        {pending ? (
          <>
            <span className="download-spinner" aria-hidden="true" />
            <span className="download-preparing-label keep-motion">{preparingLabel}</span>
          </>
        ) : readyToSave ? (
          compact ? (
            <span className="download-preparing-label">{SAVE_TO_PHOTOS_LABEL}</span>
          ) : (
            SAVE_TO_PHOTOS_LABEL
          )
        ) : compact ? (
          <>
            <DownloadIcon />
            <span className="download-ctrl-count">{idleLabel}</span>
          </>
        ) : (
          visibleLabel
        )}
      </button>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </p>
      {failed ? (
        <p className="download-error" role="status">
          {FAILED_LABEL}
        </p>
      ) : null}
      {limitOpen && !onLimit ? (
        <div className="fixed inset-0 z-(--z-modal)">
          <DownloadLimitWall nextAt={limitNextAt} onBack={() => setLimitOpen(false)} />
        </div>
      ) : null}
    </>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
