import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameSession } from "@/components/game-session";
import { formatGameWhen, toDatetimeLocalValue } from "@/lib/dates";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { getCachedGameClips, getCachedGameWithVenue, getCachedTags } from "@/lib/public-data";
import { listPublicGameIds } from "@/lib/queries";
import { getSessionShare, sessionPageMetadata } from "@/lib/share-metadata";

export const dynamic = "force-static";
export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const ids = await listPublicGameIds();
    return ids.map((id) => ({ id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const share = await getSessionShare(id);
  if (!share) {
    return {
      title: "Session",
      openGraph: { title: "Session" },
      twitter: { title: "Session" },
    };
  }
  return sessionPageMetadata(share);
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getCachedGameWithVenue(id);
  if (!game) {
    notFound();
  }

  const [clips, tags] = await Promise.all([getCachedGameClips(id), getCachedTags()]);

  return (
    <div className="container space-y-5 py-6">
      <Link href="/" className="text-sm text-muted">
        Back to nights
      </Link>
      <header className="space-y-2">
        <p className="meta">{GAME_TYPE_LABELS[game.type]}</p>
        <h1 className="display text-display-s">{game.venueName}</h1>
        <p className="meta">{formatGameWhen(game.startsAt)}</p>
      </header>
      <GameSession
        game={{
          id: game.id,
          venueId: game.venueId,
          venueName: game.venueName,
          startsAtLocal: toDatetimeLocalValue(game.startsAt),
          type: game.type,
        }}
        clips={clips}
        tags={tags}
      />
    </div>
  );
}
