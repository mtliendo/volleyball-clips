"use client";

import { useEffect, useMemo, useState } from "react";
import { GameAdminPanel } from "@/components/admin/game-admin-panel";
import { ClipGrid } from "@/components/clip-grid";
import { useMe } from "@/lib/use-me";
import type { GameType } from "@/lib/db/schema";
import type { PublicClip } from "@/lib/queries";

type VenueOption = { id: string; name: string };

export function GameSession({
  game,
  clips,
  tags,
}: {
  game: {
    id: string;
    venueId: string;
    venueName: string;
    startsAtLocal: string;
    type: GameType;
  };
  clips: PublicClip[];
  tags: { id: string; slug: string; name: string }[];
}) {
  const { viewer, favoriteClipIds } = useMe();
  const [venues, setVenues] = useState<VenueOption[]>([]);

  useEffect(() => {
    if (!viewer.isAdmin) {
      return;
    }

    let cancelled = false;
    void fetch("/api/admin/venues", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        const rows = (await response.json()) as VenueOption[];
        if (!cancelled && Array.isArray(rows)) {
          setVenues(rows);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [viewer.isAdmin]);

  const decorated = useMemo(
    () =>
      clips.map((clip) => ({
        ...clip,
        favorited: favoriteClipIds.includes(clip.id),
      })),
    [clips, favoriteClipIds],
  );

  return (
    <>
      {viewer.isAdmin ? <GameAdminPanel venues={venues} game={game} /> : null}
      {viewer.canDownload && viewer.downloadsRemaining !== null ? (
        <p className="meta">{viewer.downloadsRemaining} downloads left this week, in 1080p</p>
      ) : null}
      <ClipGrid
        clips={decorated}
        tags={tags}
        gameId={game.id}
        viewer={viewer}
        canManage={viewer.isAdmin}
      />
    </>
  );
}
