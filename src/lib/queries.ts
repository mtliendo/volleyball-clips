import "server-only";

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "./db";
import { clipTags, clips, games, tags, venues } from "./db/schema";
import { isDatabaseConfigured } from "./env";
import { monthRange } from "./dates";

export type PublicGame = {
  id: string;
  startsAt: Date;
  type: "open_gym" | "league" | "tournament";
  venueName: string;
  readyClipCount: number;
};

export type PublicClip = {
  id: string;
  originalKey: string;
  playbackKey: string | null;
  posterKey: string | null;
  durationMs: number | null;
  status: "uploading" | "processing" | "ready" | "failed";
  createdAt: Date;
  tags: { id: string; slug: string; name: string }[];
};

export async function listVenues() {
  if (!isDatabaseConfigured()) return [];
  return getDb().select().from(venues).orderBy(asc(venues.name));
}

export async function listTags() {
  if (!isDatabaseConfigured()) return [];
  return getDb().select().from(tags).orderBy(asc(tags.name));
}

export async function listMonthGames(yearMonth: Date): Promise<PublicGame[]> {
  if (!isDatabaseConfigured()) return [];

  const { start, end } = monthRange(yearMonth);
  const rows = await getDb()
    .select({
      id: games.id,
      startsAt: games.startsAt,
      type: games.type,
      venueName: venues.name,
    })
    .from(games)
    .innerJoin(venues, eq(games.venueId, venues.id))
    .where(and(gte(games.startsAt, start), lte(games.startsAt, end)))
    .orderBy(asc(games.startsAt));

  if (rows.length === 0) {
    return [];
  }

  const readyRows = await getDb()
    .select({
      gameId: clips.gameId,
      status: clips.status,
    })
    .from(clips)
    .where(eq(clips.status, "ready"));

  const counts = new Map<string, number>();
  for (const row of readyRows) {
    counts.set(row.gameId, (counts.get(row.gameId) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...row,
    readyClipCount: counts.get(row.id) ?? 0,
  }));
}

export async function getGameWithVenue(gameId: string) {
  if (!isDatabaseConfigured()) return null;

  const [row] = await getDb()
    .select({
      id: games.id,
      startsAt: games.startsAt,
      type: games.type,
      venueId: games.venueId,
      venueName: venues.name,
    })
    .from(games)
    .innerJoin(venues, eq(games.venueId, venues.id))
    .where(eq(games.id, gameId))
    .limit(1);

  return row ?? null;
}

export async function listGameClips(
  gameId: string,
  options: { readyOnly?: boolean } = {},
): Promise<PublicClip[]> {
  if (!isDatabaseConfigured()) return [];

  const clipRows = await getDb()
    .select()
    .from(clips)
    .where(
      options.readyOnly
        ? and(eq(clips.gameId, gameId), eq(clips.status, "ready"))
        : eq(clips.gameId, gameId),
    )
    .orderBy(asc(clips.createdAt));

  if (clipRows.length === 0) {
    return [];
  }

  const tagRows = await getDb()
    .select({
      clipId: clipTags.clipId,
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
    })
    .from(clipTags)
    .innerJoin(tags, eq(clipTags.tagId, tags.id));

  const tagsByClip = new Map<string, PublicClip["tags"]>();
  for (const row of tagRows) {
    const list = tagsByClip.get(row.clipId) ?? [];
    list.push({ id: row.id, slug: row.slug, name: row.name });
    tagsByClip.set(row.clipId, list);
  }

  return clipRows.map((clip) => ({
    ...clip,
    tags: tagsByClip.get(clip.id) ?? [],
  }));
}

export async function listAdminGames() {
  if (!isDatabaseConfigured()) return [];

  return getDb()
    .select({
      id: games.id,
      startsAt: games.startsAt,
      type: games.type,
      venueId: games.venueId,
      venueName: venues.name,
    })
    .from(games)
    .innerJoin(venues, eq(games.venueId, venues.id))
    .orderBy(asc(games.startsAt));
}
