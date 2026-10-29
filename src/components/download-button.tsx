"use client";

import { useState } from "react";
import { AuthLoginAnchor } from "@/components/auth-login-anchor";
import { DownloadLimitWall } from "@/components/download-limit-wall";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { DOWNLOADS_REMAINING_HEADER, filenameFromContentDisposition } from "@/lib/download";

const PREPARING_LABEL = "Preparing download...";
const FAILED_LABEL = "Download failed. Try again.";

export function DownloadButton({
  clipId,
  canDownload,
  isPro,
  remaining,
  returnTo,
  compact = false,
  quality,
  nextDownloadAt = null,
  startLimitOpen = false,
  onRemainingChange,
  onLimit,
}: {
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
}) {
  const [pending, setPending] = useState(false);
  const [limitOpen, setLimitOpen] = useState(startLimitOpen);
  const [limitNextAt, setLimitNextAt] = useState<string | null>(nextDownloadAt);
  const [failed, setFailed] = useState(false);
  const [localRemaining, setLocalRemaining] = useState(remaining);
  const left = onRemainingChange ? remaining : localRemaining;
  const resolvedQuality = quality ?? (isPro ? "original" : "playback");

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

  async function onDownload() {
    if (pending) return;
    setFailed(false);

    if (!isPro && left === 0) {
      showLimit();
      return;
    }

    setPending(true);
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

      const blob = await response.blob();
      const filename =
        filenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
        (resolvedQuality === "original" ? "vbpov-original.mp4" : "vbpov-1080p.mp4");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

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

  const className = [
    compact ? "icon-btn download-ctrl" : "btn btn-ghost",
    pending ? "is-preparing" : "",
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
        aria-label={pending ? PREPARING_LABEL : idleAria}
        aria-busy={pending}
        aria-disabled={pending}
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onDownload();
        }}
      >
        {pending ? (
          <>
            <span className="download-spinner" aria-hidden="true" />
            <span className="download-preparing-label keep-motion">{PREPARING_LABEL}</span>
          </>
        ) : compact ? (
          <>
            <DownloadIcon />
            <span className="download-ctrl-count">{idleLabel}</span>
          </>
        ) : (
          `Download ${idleLabel}`
        )}
      </button>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {pending ? PREPARING_LABEL : failed ? FAILED_LABEL : ""}
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
