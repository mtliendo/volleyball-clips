import { NextResponse } from "next/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { trackServerEvent } from "@/lib/analytics-server";
import { getSession } from "@/lib/admin";
import { ANON_WATCH_LIMIT } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import { isUuid } from "@/lib/ids";
import { remainingFromCounts, recordWatch, watchCountsForToday } from "@/lib/limits";
import { makePlaybackGrant } from "@/lib/playback-access";
import type { PlaybackGrant } from "@/lib/playback";
import { getReadyClip, getReadyClips } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { getVisitorIdentity, visitorCookieHeader } from "@/lib/visitor";

const MAX_PRELOAD = 2;

function readWatchBody(raw: unknown) {
  const body = (raw ?? {}) as { clipId?: unknown; preloadClipIds?: unknown };
  const clipId = typeof body.clipId === "string" ? body.clipId : "";
  const preloadClipIds = Array.isArray(body.preloadClipIds)
    ? body.preloadClipIds
        .filter((id): id is string => typeof id === "string" && isUuid(id))
        .slice(0, MAX_PRELOAD)
    : [];
  return { clipId, preloadClipIds };
}

async function preloadGrants(input: {
  gameId: string;
  clipId: string;
  preloadClipIds: string[];
  unlimited: boolean;
  watchedClipIds: Set<string>;
  remainingAfter: number;
}): Promise<PlaybackGrant[]> {
  const ids = input.preloadClipIds.filter((id) => id !== input.clipId);
  if (ids.length === 0) return [];

  const rows = await getReadyClips(ids);
  const grants: PlaybackGrant[] = [];
  for (const row of rows) {
    if (row.gameId !== input.gameId) continue;
    const already = input.watchedClipIds.has(row.id);
    if (!input.unlimited && !already && input.remainingAfter <= 0) {
      continue;
    }
    const grant = makePlaybackGrant(row.id, row.playbackKey);
    if (grant) grants.push(grant);
  }
  return grants;
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { clipId, preloadClipIds } = readWatchBody(
    await request.json().catch(() => ({})),
  );
  if (!clipId) {
    return NextResponse.json({ error: "clipId is required" }, { status: 400 });
  }

  const clip = await getReadyClip(clipId);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const session = await getSession();
  if (session && (isAdmin(session.user) || session.user.sub)) {
    const playback = makePlaybackGrant(clip.id, clip.playbackKey);
    const preload = await preloadGrants({
      gameId: clip.gameId,
      clipId: clip.id,
      preloadClipIds,
      unlimited: true,
      watchedClipIds: new Set(),
      remainingAfter: Number.POSITIVE_INFINITY,
    });
    return NextResponse.json({
      allowed: true,
      remaining: null,
      unlimited: true,
      playback,
      preload,
    });
  }

  const identity = await getVisitorIdentity();
  const counts = await watchCountsForToday(identity);
  const already = counts.watchedClipIds.has(clip.id);
  const remaining = remainingFromCounts(counts.visitorCount, counts.ipCount);

  if (!already && remaining <= 0) {
    trackServerEvent(ANALYTICS_EVENTS.watchLimitHit, { clip_id: clip.id });
    const response = NextResponse.json(
      {
        allowed: false,
        remaining: 0,
        limit: ANON_WATCH_LIMIT,
        reason: "signup_required",
      },
      { status: 403 },
    );
    if (identity.issued) {
      response.headers.append("Set-Cookie", visitorCookieHeader(identity.visitorId));
    }
    return response;
  }

  await recordWatch({
    clipId: clip.id,
    visitorId: identity.visitorId,
    ipHash: identity.ipHash,
    watchedOn: identity.watchedOn,
  });

  const nextRemaining = already ? remaining : Math.max(0, remaining - 1);
  const watchedClipIds = new Set(counts.watchedClipIds);
  watchedClipIds.add(clip.id);
  const playback = makePlaybackGrant(clip.id, clip.playbackKey);
  const preload = await preloadGrants({
    gameId: clip.gameId,
    clipId: clip.id,
    preloadClipIds,
    unlimited: false,
    watchedClipIds,
    remainingAfter: nextRemaining,
  });

  const response = NextResponse.json({
    allowed: true,
    remaining: nextRemaining,
    limit: ANON_WATCH_LIMIT,
    playback,
    preload,
  });
  if (identity.issued) {
    response.headers.append("Set-Cookie", visitorCookieHeader(identity.visitorId));
  }
  return response;
}
