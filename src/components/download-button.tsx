"use client";

import { useState } from "react";
import { DownloadLimitWall } from "@/components/download-limit-wall";
import { TrackAnchor } from "@/components/track-click";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { authLoginHref } from "@/lib/auth-urls";
import { DOWNLOADS_REMAINING_HEADER, filenameFromContentDisposition } from "@/lib/download";

export function DownloadButton({
  clipId,
  canDownload,
  isPro,
  remaining,
  returnTo,
  compact = false,
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

  if (!canDownload) {
    return (
      <TrackAnchor
        href={authLoginHref({ returnTo, signup: true })}
        event={ANALYTICS_EVENTS.signupClick}
        className={compact ? "icon-btn" : "btn btn-ghost"}
        data-download-control=""
        data-clip-id={clipId}
      >
        {compact ? <DownloadIcon /> : "Sign in to download"}
      </TrackAnchor>
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
      const response = await fetch(`/api/clips/${clipId}/download`);
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
        (isPro ? "vbpov-original.mp4" : "vbpov-1080p.mp4");
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

  const label = isPro
    ? "Original"
    : left === null
      ? "1080p"
      : `${left} left`;

  return (
    <>
      <button
        type="button"
        className={compact ? "icon-btn download-ctrl" : "btn btn-ghost"}
        data-download-control=""
        data-clip-id={clipId}
        data-download-remaining={left === null ? undefined : String(left)}
        data-download-pending={pending ? "true" : undefined}
        aria-label={
          isPro
            ? "Download original"
            : left === null
              ? "Download 1080p"
              : `Download 1080p, ${left} left this week`
        }
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          void onDownload();
        }}
      >
        {compact ? (
          <>
            <DownloadIcon />
            <span className="download-ctrl-count">
              {!isPro && left !== null ? `${left} left` : isPro ? "Original" : "1080p"}
            </span>
          </>
        ) : (
          `Download ${label}`
        )}
      </button>
      {failed ? (
        <p className="download-error" role="status">
          Download failed. Try again.
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
