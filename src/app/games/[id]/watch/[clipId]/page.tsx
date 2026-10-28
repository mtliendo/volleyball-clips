import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { VerticalFeed } from "@/components/vertical-feed";
import { getViewer } from "@/lib/entitlements";
import {
  initialFeedPlayback,
  isPlaybackSigningEnabled,
} from "@/lib/playback-access";
import { getGameWithVenue, listGameClips, listTags } from "@/lib/queries";
import { clipPageMetadata, getClipShare } from "@/lib/share-metadata";

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
  searchParams,
}: {
  params: Promise<{ id: string; clipId: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { id, clipId } = await params;
  const { tag } = await searchParams;
  await connection();

  const game = await getGameWithVenue(id);
  if (!game) {
    notFound();
  }

  const viewer = await getViewer();
  const [clips, catalogTags] = await Promise.all([
    listGameClips(id, {
      readyOnly: true,
      favoriteUserId: viewer.appUserId,
    }),
    listTags(),
  ]);

  const filtered = tag
    ? clips.filter((clip) => clip.tags.some((item) => item.slug === tag))
    : clips;
  const feed = filtered.some((clip) => clip.id === clipId) ? filtered : clips;
  if (!feed.some((clip) => clip.id === clipId)) {
    notFound();
  }

  const closeQuery = tag ? `?tag=${encodeURIComponent(tag)}` : "";
  const requireSignedPlayback = isPlaybackSigningEnabled();
  // Guests wait for POST /api/watch so the 7-a-day cap is checked before a URL is issued.
  const initialPlayback =
    viewer.watchUnlimited && requireSignedPlayback
      ? initialFeedPlayback(feed, clipId)
      : {};

  return (
    <VerticalFeed
      clips={feed}
      startId={clipId}
      gameId={id}
      tag={tag ?? null}
      catalogTags={catalogTags}
      viewer={viewer}
      closeHref={`/games/${id}${closeQuery}`}
      initialPlayback={initialPlayback}
      requireSignedPlayback={requireSignedPlayback}
    />
  );
}
