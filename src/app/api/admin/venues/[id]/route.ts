import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { games, venues } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";

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
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [venue] = await getDb()
    .update(venues)
    .set({ name })
    .where(eq(venues.id, id))
    .returning();

  if (!venue) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  return NextResponse.json(venue);
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
  const [inUse] = await getDb()
    .select({ id: games.id })
    .from(games)
    .where(eq(games.venueId, id))
    .limit(1);

  if (inUse) {
    return NextResponse.json(
      { error: "Venue still has games. Move or delete those first." },
      { status: 409 },
    );
  }

  const [venue] = await getDb().delete(venues).where(eq(venues.id, id)).returning();
  if (!venue) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
