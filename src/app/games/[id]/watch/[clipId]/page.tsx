import { notFound } from "next/navigation";
import { connection } from "next/server";
import { VerticalFeed } from "@/components/vertical-feed";
import { getViewer } from "@/lib/entitlements";
import { getGameWithVenue, listGameClips, listTags } from "@/lib/queries";

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

  return (
    <VerticalFeed
      clips={feed}
      startId={clipId}
      gameId={id}
      tag={tag ?? null}
      catalogTags={catalogTags}
      viewer={viewer}
      closeHref={`/games/${id}${closeQuery}`}
    />
  );
}
