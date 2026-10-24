import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { clipTags, clips, tags } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import { inArray } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const body = (await request.json()) as { tagIds?: string[] };
  const tagIds = Array.isArray(body.tagIds) ? [...new Set(body.tagIds)] : [];

  const [clip] = await getDb().select().from(clips).where(eq(clips.id, id)).limit(1);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (tagIds.length > 0) {
    const existing = await getDb().select({ id: tags.id }).from(tags).where(inArray(tags.id, tagIds));
    if (existing.length !== tagIds.length) {
      return NextResponse.json({ error: "Unknown tag" }, { status: 400 });
    }
  }

  await getDb().delete(clipTags).where(eq(clipTags.clipId, id));
  if (tagIds.length > 0) {
    await getDb()
      .insert(clipTags)
      .values(tagIds.map((tagId) => ({ clipId: id, tagId })));
  }

  return NextResponse.json({ ok: true, tagIds });
}
