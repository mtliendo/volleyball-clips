import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { clips } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const [existing] = await getDb().select().from(clips).where(eq(clips.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (existing.status === "ready" || existing.status === "failed") {
    return NextResponse.json(existing);
  }

  const [clip] = await getDb()
    .update(clips)
    .set({ status: "processing" })
    .where(eq(clips.id, id))
    .returning();

  return NextResponse.json(clip);
}
