import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { fromDatetimeLocalValue } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { games, type GameType } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";

const TYPES = new Set(["open_gym", "league", "tournament"]);

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

  if (body.venueId) patch.venueId = body.venueId;
  if (body.startsAt) patch.startsAt = fromDatetimeLocalValue(body.startsAt);
  if (body.type) {
    if (!TYPES.has(body.type)) {
      return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
    }
    patch.type = body.type as GameType;
  }

  const [game] = await getDb().update(games).set(patch).where(eq(games.id, id)).returning();
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(game);
}
