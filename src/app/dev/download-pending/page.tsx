import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DownloadButton } from "@/components/download-button";
import { VERIFY_CLIP_IDS, isVerifyHarnessEnabled, verifyViewer } from "@/lib/verify-feed";

export const dynamic = "force-dynamic";

export default async function VerifyDownloadPendingPage() {
  await connection();
  if (!isVerifyHarnessEnabled()) {
    notFound();
  }

  const clipId = VERIFY_CLIP_IDS[0];
  const pro = verifyViewer({ isPro: true, downloadsRemaining: null });
  const free = verifyViewer({ isPro: false, downloadsRemaining: 3 });

  return (
    <div className="container space-y-8 py-10" data-verify-download-pending="">
      <header className="space-y-2">
        <h1 className="display text-display-s">Download pending</h1>
        <p className="lead">Verify harness for the preparing state.</p>
      </header>

      <section className="well space-y-4 p-5" data-verify-download-surface="feed">
        <p className="meta">Feed / session compact, original</p>
        <div className="flex justify-end">
          <DownloadButton
            clipId={clipId}
            canDownload={pro.canDownload}
            isPro={pro.isPro}
            remaining={pro.downloadsRemaining}
            returnTo="/dev/download-pending"
            compact
            quality="original"
          />
        </div>
      </section>

      <section className="well space-y-4 p-5" data-verify-download-surface="session">
        <p className="meta">Session / favorites compact, 1080p</p>
        <div className="flex justify-end">
          <DownloadButton
            clipId={clipId}
            canDownload={free.canDownload}
            isPro={free.isPro}
            remaining={free.downloadsRemaining}
            returnTo="/dev/download-pending"
            compact
            quality="playback"
          />
        </div>
      </section>

      <section className="well space-y-4 p-5" data-verify-download-surface="full">
        <p className="meta">Full button</p>
        <DownloadButton
          clipId={clipId}
          canDownload={pro.canDownload}
          isPro={pro.isPro}
          remaining={pro.downloadsRemaining}
          returnTo="/dev/download-pending"
          quality="original"
        />
      </section>
    </div>
  );
}
