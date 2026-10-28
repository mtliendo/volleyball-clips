import "server-only";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  ANON_WATCH_LIMIT,
  FREE_DOWNLOADS_PER_WEEK,
  downloadEvents,
  watchEvents,
} from "./db/schema";
import { isDatabaseConfigured } from "./env";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function countDownloadsThisWeek(userId: string) {
  if (!isDatabaseConfigured()) return 0;
  const since = new Date(Date.now() - WEEK_MS);
  const [row] = await getDb()
    .select({ total: count() })
    .from(downloadEvents)
    .where(and(eq(downloadEvents.userId, userId), gte(downloadEvents.createdAt, since)));
  return Number(row?.total ?? 0);
}

export async function recordDownload(input: {
  userId: string;
  clipId: string;
  quality: "playback" | "original";
}) {
  await getDb().insert(downloadEvents).values(input);
}

export async function watchCountsForToday(input: {
  visitorId: string;
  ipHash: string;
  watchedOn: string;
}) {
  if (!isDatabaseConfigured()) {
    return { visitorCount: 0, ipCount: 0, watchedClipIds: new Set<string>() };
  }

  const rows = await getDb()
    .select({
      clipId: watchEvents.clipId,
      visitorId: watchEvents.visitorId,
      ipHash: watchEvents.ipHash,
    })
    .from(watchEvents)
    .where(
      and(
        eq(watchEvents.watchedOn, input.watchedOn),
        sql`(${watchEvents.visitorId} = ${input.visitorId} or ${watchEvents.ipHash} = ${input.ipHash})`,
      ),
    );

  const visitorClips = new Set<string>();
  const ipClips = new Set<string>();
  for (const row of rows) {
    if (row.visitorId === input.visitorId) visitorClips.add(row.clipId);
    if (row.ipHash === input.ipHash) ipClips.add(row.clipId);
  }

  return {
    visitorCount: visitorClips.size,
    ipCount: ipClips.size,
    watchedClipIds: new Set([...visitorClips, ...ipClips]),
  };
}

export async function recordWatch(input: {
  clipId: string;
  visitorId: string;
  ipHash: string;
  watchedOn: string;
}) {
  await getDb()
    .insert(watchEvents)
    .values(input)
    .onConflictDoNothing({
      target: [watchEvents.visitorId, watchEvents.clipId, watchEvents.watchedOn],
    });
}

export function remainingFromCounts(visitorCount: number, ipCount: number) {
  return Math.max(0, ANON_WATCH_LIMIT - Math.max(visitorCount, ipCount));
}

export { ANON_WATCH_LIMIT, FREE_DOWNLOADS_PER_WEEK };
