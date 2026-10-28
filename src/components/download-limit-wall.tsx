"use client";

import Link from "next/link";
import { formatNextDownloadWhen } from "@/lib/dates";

export function DownloadLimitWall({
  nextAt,
  onBack,
}: {
  nextAt?: string | null;
  onBack?: () => void;
}) {
  const when = nextAt ? formatNextDownloadWhen(new Date(nextAt)) : null;

  return (
    <div className="flex min-h-full flex-col justify-end bg-paper/92 p-5" data-download-limit="">
      <div className="mx-auto w-full max-w-sm space-y-4">
        <h2 className="display text-section">That is three for the week</h2>
        <p className="lead">
          Those 1080p files are used up. Pro is $5 a month for the originals, with no weekly cap.
        </p>
        {when ? <p className="meta">Another one frees up {when}.</p> : null}
        <div className="flex flex-col gap-2">
          <Link href="/pricing" className="btn btn-primary">
            Go Pro, $5 a month
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => onBack?.()}>
            Back to the clip
          </button>
        </div>
      </div>
    </div>
  );
}
