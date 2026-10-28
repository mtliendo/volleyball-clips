import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "./db";
import {
  clipTags,
  clips,
  favorites,
  games,
  sessionPins,
  tags,
  venues,
  type PinLabel,
} from "./db/schema";
import { isDatabaseConfigured } from "./env";
import { monthRange } from "./dates";
import { isUuid } from "./ids";

export type PublicGame = {
  id: string;
  startsAt: Date;
  type: "open_gym" | "league" | "tournament";
  venueName: string;
  readyClipCount: number;
};

export type ClipPin = {
  label: PinLabel | null;
  position: number;
};

export type PublicClip = {
  id: string;
  gameId: string;
  originalKey: string;
  playbackKey: string | null;
  posterKey: string | null;
  durationMs: number | null;
  status: "uploading" | "processing" | "ready" | "failed";
  createdAt: Date;
  tags: { id: string; slug: string; name: string }[];
  pin: ClipPin | null;
  favorited: boolean;
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
  if (!isDatabaseConfigured() || !isUuid(gameId)) return null;

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
  options: { readyOnly?: boolean; favoriteUserId?: string | null } = {},
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

  const clipIds = clipRows.map((clip) => clip.id);
  const [tagRows, pinRows, favoriteRows] = await Promise.all([
    getDb()
      .select({
        clipId: clipTags.clipId,
        id: tags.id,
        slug: tags.slug,
        name: tags.name,
      })
      .from(clipTags)
      .innerJoin(tags, eq(clipTags.tagId, tags.id))
      .where(inArray(clipTags.clipId, clipIds)),
    getDb()
      .select()
      .from(sessionPins)
      .where(eq(sessionPins.gameId, gameId)),
    options.favoriteUserId
      ? getDb()
          .select({ clipId: favorites.clipId })
          .from(favorites)
          .where(
            and(
              eq(favorites.userId, options.favoriteUserId),
              inArray(favorites.clipId, clipIds),
            ),
          )
      : Promise.resolve([] as { clipId: string }[]),
  ]);

  const tagsByClip = new Map<string, PublicClip["tags"]>();
  for (const row of tagRows) {
    const list = tagsByClip.get(row.clipId) ?? [];
    list.push({ id: row.id, slug: row.slug, name: row.name });
    tagsByClip.set(row.clipId, list);
  }

  const pinByClip = new Map<string, ClipPin>();
  for (const pin of pinRows) {
    pinByClip.set(pin.clipId, { label: pin.label, position: pin.position });
  }

  const favoriteSet = new Set(favoriteRows.map((row) => row.clipId));

  return clipRows
    .map((clip) => ({
      ...clip,
      tags: tagsByClip.get(clip.id) ?? [],
      pin: pinByClip.get(clip.id) ?? null,
      favorited: favoriteSet.has(clip.id),
    }))
    .sort((a, b) => {
      if (a.pin && b.pin) return a.pin.position - b.pin.position;
      if (a.pin) return -1;
      if (b.pin) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
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
    .orderBy(desc(games.startsAt));
}

export async function listFavoriteClips(userId: string): Promise<
  (PublicClip & { venueName: string; startsAt: Date; gameType: PublicGame["type"] })[]
> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb()
    .select({
      clip: clips,
      venueName: venues.name,
      startsAt: games.startsAt,
      gameType: games.type,
    })
    .from(favorites)
    .innerJoin(clips, eq(favorites.clipId, clips.id))
    .innerJoin(games, eq(clips.gameId, games.id))
    .innerJoin(venues, eq(games.venueId, venues.id))
    .where(and(eq(favorites.userId, userId), eq(clips.status, "ready")))
    .orderBy(desc(favorites.createdAt));

  if (rows.length === 0) return [];

  const clipIds = rows.map((row) => row.clip.id);
  const gameIds = [...new Set(rows.map((row) => row.clip.gameId))];
  const [tagRows, pinRows] = await Promise.all([
    getDb()
      .select({
        clipId: clipTags.clipId,
        id: tags.id,
        slug: tags.slug,
        name: tags.name,
      })
      .from(clipTags)
      .innerJoin(tags, eq(clipTags.tagId, tags.id))
      .where(inArray(clipTags.clipId, clipIds)),
    getDb().select().from(sessionPins).where(inArray(sessionPins.gameId, gameIds)),
  ]);

  const tagsByClip = new Map<string, PublicClip["tags"]>();
  for (const row of tagRows) {
    const list = tagsByClip.get(row.clipId) ?? [];
    list.push({ id: row.id, slug: row.slug, name: row.name });
    tagsByClip.set(row.clipId, list);
  }

  const pinByClip = new Map<string, ClipPin>();
  for (const pin of pinRows) {
    pinByClip.set(pin.clipId, { label: pin.label, position: pin.position });
  }

  return rows.map((row) => ({
    ...row.clip,
    tags: tagsByClip.get(row.clip.id) ?? [],
    pin: pinByClip.get(row.clip.id) ?? null,
    favorited: true,
    venueName: row.venueName,
    startsAt: row.startsAt,
    gameType: row.gameType,
  }));
}

export async function listRecentReadyPosters(limit = 8) {
  if (!isDatabaseConfigured()) return [];

  return getDb()
    .select({
      id: clips.id,
      gameId: clips.gameId,
      posterKey: clips.posterKey,
      venueName: venues.name,
    })
    .from(clips)
    .innerJoin(games, eq(clips.gameId, games.id))
    .innerJoin(venues, eq(games.venueId, venues.id))
    .where(eq(clips.status, "ready"))
    .orderBy(desc(clips.createdAt))
    .limit(limit);
}

export async function getReadyClip(clipId: string) {
  if (!isDatabaseConfigured() || !isUuid(clipId)) return null;
  const [row] = await getDb()
    .select()
    .from(clips)
    .where(and(eq(clips.id, clipId), eq(clips.status, "ready")))
    .limit(1);
  return row ?? null;
}
