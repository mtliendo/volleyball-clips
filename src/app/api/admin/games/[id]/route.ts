import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { fromDatetimeLocalValue } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { clipTags, clips, games, venues, type GameType } from "@/lib/db/schema";
import { isDatabaseConfigured, isS3Configured } from "@/lib/env";
import { isUuid } from "@/lib/ids";
import { deleteClipObjects } from "@/lib/s3";

const TYPES = new Set(["open_gym", "league", "tournament"]);
const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    venueId?: string;
    startsAt?: string;
    type?: string;
  };

  const patch: {
    venueId?: string;
    startsAt?: Date;
    type?: GameType;
  } = {};

  if (body.venueId) {
    if (!isUuid(body.venueId)) {
      return NextResponse.json({ error: "Invalid venue" }, { status: 400 });
    }
    const [venue] = await getDb()
      .select({ id: venues.id })
      .from(venues)
      .where(eq(venues.id, body.venueId))
      .limit(1);
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 400 });
    }
    patch.venueId = body.venueId;
  }

  if (body.startsAt) {
    if (!DATETIME_LOCAL.test(body.startsAt)) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
    }
    patch.startsAt = fromDatetimeLocalValue(body.startsAt);
  }

  if (body.type) {
    if (!TYPES.has(body.type)) {
      return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
    }
    patch.type = body.type as GameType;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [game] = await getDb().update(games).set(patch).where(eq(games.id, id)).returning();
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(game);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const [game] = await getDb().select().from(games).where(eq(games.id, id)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const gameClips = await getDb().select().from(clips).where(eq(clips.gameId, id));

  if (gameClips.length > 0) {
    if (!isS3Configured()) {
      return NextResponse.json(
        { error: "S3 is not configured; clip files cannot be deleted" },
        { status: 503 },
      );
    }

    let failed: { key: string; message: string }[] = [];
    try {
      ({ failed } = await deleteClipObjects(gameClips));
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not delete S3 objects. Database rows were left unchanged.",
        },
        { status: 502 },
      );
    }

    if (failed.length > 0) {
      return NextResponse.json(
        {
          error: "Could not delete all S3 objects. Database rows were left unchanged.",
          failed,
        },
        { status: 502 },
      );
    }
  }

  const clipIds = gameClips.map((clip) => clip.id);
  await getDb().transaction(async (tx) => {
    if (clipIds.length > 0) {
      await tx.delete(clipTags).where(inArray(clipTags.clipId, clipIds));
      await tx.delete(clips).where(eq(clips.gameId, id));
    }
    await tx.delete(games).where(eq(games.id, id));
  });

  return NextResponse.json({ ok: true });
}
