import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { clipTags, clips } from "@/lib/db/schema";
import { isDatabaseConfigured, isS3Configured } from "@/lib/env";
import { isUuid } from "@/lib/ids";
import { deleteClipObjects } from "@/lib/s3";

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
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const [clip] = await getDb().select().from(clips).where(eq(clips.id, id)).limit(1);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: "S3 is not configured; clip files cannot be deleted" },
      { status: 503 },
    );
  }

  let failed: { key: string; message: string }[] = [];
  try {
    ({ failed } = await deleteClipObjects([clip]));
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

  await getDb().transaction(async (tx) => {
    await tx.delete(clipTags).where(eq(clipTags.clipId, id));
    await tx.delete(clips).where(eq(clips.id, id));
  });

  return NextResponse.json({ ok: true });
}
