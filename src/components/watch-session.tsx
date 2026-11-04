"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { VerticalFeed } from "@/components/vertical-feed";
import { useMe } from "@/lib/use-me";
import type { PublicClip } from "@/lib/queries";

function WatchSessionInner({
  clips,
  startId,
  gameId,
  requireSignedPlayback,
}: {
  clips: PublicClip[];
  startId: string;
  gameId: string;
  requireSignedPlayback: boolean;
}) {
  const { viewer, favoriteClipIds } = useMe();
  const tag = useSearchParams().get("tag");
  const decorated = useMemo(
    () =>
      clips.map((clip) => ({
        ...clip,
        favorited: favoriteClipIds.includes(clip.id),
      })),
    [clips, favoriteClipIds],
  );
  const filtered = tag
    ? decorated.filter((clip) => clip.tags.some((item) => item.slug === tag))
    : decorated;
  const feed = filtered.some((clip) => clip.id === startId) ? filtered : decorated;
  const closeQuery = tag ? `?tag=${encodeURIComponent(tag)}` : "";

  return (
    <VerticalFeed
      clips={feed}
      startId={startId}
      gameId={gameId}
      tag={tag}
      viewer={viewer}
      closeHref={`/games/${gameId}${closeQuery}`}
      initialPlayback={{}}
      requireSignedPlayback={requireSignedPlayback}
    />
  );
}

export function WatchSession(props: {
  clips: PublicClip[];
  startId: string;
  gameId: string;
  requireSignedPlayback: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <WatchSessionInner {...props} />
    </Suspense>
  );
}
