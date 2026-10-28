"use client";

import { TrackLink } from "@/components/track-click";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
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
          You&apos;ve used your 3 free downloads this week. Pro is $5 a month for unlimited downloads and the original files.
        </p>
        {when ? <p className="meta">Another one frees up {when}.</p> : null}
        <div className="flex flex-col gap-2">
          <TrackLink href="/pricing" event={ANALYTICS_EVENTS.goProClick} className="btn btn-primary">
            Go Pro, $5 a month
          </TrackLink>
          <button type="button" className="btn btn-ghost" onClick={() => onBack?.()}>
            Back to the clip
          </button>
        </div>
      </div>
    </div>
  );
}
