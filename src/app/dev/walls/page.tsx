import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DownloadLimitWall } from "@/components/download-limit-wall";
import { SignupWall } from "@/components/signup-wall";

export const dynamic = "force-dynamic";

export default async function VerifyWallsPage() {
  await connection();
  if (process.env.VERIFY_FEED_HARNESS !== "1") {
    notFound();
  }

  return (
    <div className="flex min-h-dvh justify-center bg-paper" data-verify-walls="">
      <div className="flex w-[780px] max-w-full">
        <section className="relative h-[844px] min-h-[100dvh] w-[390px] min-w-0 flex-1 overflow-hidden bg-paper">
          <p className="meta absolute top-3 left-4 z-(--z-raised)">Seven a day</p>
          <SignupWall returnTo="/games/demo/watch/demo" />
        </section>
        <section className="relative h-[844px] min-h-[100dvh] w-[390px] min-w-0 flex-1 overflow-hidden bg-paper">
          <p className="meta absolute top-3 left-4 z-(--z-raised)">Three a week</p>
          <DownloadLimitWall nextAt="2026-11-06T18:00:00.000Z" />
        </section>
      </div>
    </div>
  );
}
