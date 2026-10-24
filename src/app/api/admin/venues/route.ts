import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { venues } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";

export async function GET() {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const rows = await getDb().select().from(venues);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [venue] = await getDb().insert(venues).values({ name }).returning();
  return NextResponse.json(venue, { status: 201 });
}
