import { authLoginHref } from "@/lib/auth-urls";

export function DownloadButton({
  clipId,
  canDownload,
  isPro,
  remaining,
  returnTo,
  compact = false,
}: {
  clipId: string;
  canDownload: boolean;
  isPro: boolean;
  remaining: number | null;
  returnTo: string;
  compact?: boolean;
}) {
  if (!canDownload) {
    return (
      <a href={authLoginHref({ returnTo, signup: true })} className={compact ? "icon-btn" : "btn btn-ghost"}>
        {compact ? <DownloadIcon /> : "Sign in to download"}
      </a>
    );
  }

  const label = isPro
    ? "Original"
    : remaining === null
      ? "1080p"
      : `${remaining} left`;

  return (
    <a
      href={`/api/clips/${clipId}/download`}
      className={compact ? "icon-btn" : "btn btn-ghost"}
      aria-label={isPro ? "Download original" : "Download 1080p"}
    >
      {compact ? <DownloadIcon /> : `Download ${label}`}
    </a>
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
