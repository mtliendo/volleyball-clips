import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchSession } from "@/components/watch-session";
import { isPlaybackSigningEnabled } from "@/lib/playback-access";
import { getCachedGameClips, getCachedGameWithVenue } from "@/lib/public-data";
import { listReadyWatchParams } from "@/lib/queries";
import { clipPageMetadata, getClipShare } from "@/lib/share-metadata";

export const dynamic = "force-static";
export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    return await listReadyWatchParams();
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}): Promise<Metadata> {
  const { id, clipId } = await params;
  const share = await getClipShare(id, clipId);
  if (!share) {
    return {
      title: "Clip",
      openGraph: { title: "Clip" },
      twitter: { title: "Clip" },
    };
  }
  return clipPageMetadata(share);
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}) {
  const { id, clipId } = await params;
  const game = await getCachedGameWithVenue(id);
  if (!game) {
    notFound();
  }

  const clips = await getCachedGameClips(id);
  if (!clips.some((clip) => clip.id === clipId)) {
    notFound();
  }

  return (
    <WatchSession
      clips={clips}
      startId={clipId}
      gameId={id}
      requireSignedPlayback={isPlaybackSigningEnabled()}
    />
  );
}
