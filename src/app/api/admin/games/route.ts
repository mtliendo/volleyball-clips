import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { fromDatetimeLocalValue } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { games, type GameType } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";

const TYPES = new Set(["open_gym", "league", "tournament"]);

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    venueId?: string;
    startsAt?: string;
    type?: string;
  };

  if (!body.venueId || !body.startsAt || !body.type || !TYPES.has(body.type)) {
    return NextResponse.json({ error: "venueId, startsAt, and type are required" }, { status: 400 });
  }

  const [game] = await getDb()
    .insert(games)
    .values({
      venueId: body.venueId,
      startsAt: fromDatetimeLocalValue(body.startsAt),
      type: body.type as GameType,
    })
    .returning();

  return NextResponse.json(game, { status: 201 });
}
