import { NextResponse } from "next/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { trackServerEvent } from "@/lib/analytics-server";
import { getSession } from "@/lib/admin";
import { ANON_WATCH_LIMIT } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import { remainingFromCounts, recordWatch, watchCountsForToday } from "@/lib/limits";
import { getReadyClip } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { getVisitorIdentity, visitorCookieHeader } from "@/lib/visitor";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { clipId?: string };
  if (!body.clipId) {
    return NextResponse.json({ error: "clipId is required" }, { status: 400 });
  }

  const clip = await getReadyClip(body.clipId);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const session = await getSession();
  if (session && (isAdmin(session.user) || session.user.sub)) {
    return NextResponse.json({
      allowed: true,
      remaining: null,
      unlimited: true,
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
  const response = NextResponse.json({
    allowed: true,
    remaining: nextRemaining,
    limit: ANON_WATCH_LIMIT,
  });
  if (identity.issued) {
    response.headers.append("Set-Cookie", visitorCookieHeader(identity.visitorId));
  }
  return response;
}
