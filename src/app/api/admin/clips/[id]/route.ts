import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { deleteAdminClip } from "@/lib/admin-clip-delete";
import { getDb } from "@/lib/db";
import { clipTags, clips } from "@/lib/db/schema";
import { isDatabaseConfigured, isS3Configured } from "@/lib/env";
import { isUuid } from "@/lib/ids";
import { revalidatePublicContent } from "@/lib/public-cache";
import { deleteClipObjects } from "@/lib/s3";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await deleteAdminClip(id, {
    async authorize() {
      const { error } = await requireAdminApi();
      if (!error) return { ok: true };
      if (error.status === 401) {
        return { ok: false, status: 401, error: "Unauthorized" };
      }
      return { ok: false, status: 403, error: "Forbidden" };
    },
    isDatabaseConfigured,
    isS3Configured,
    isUuid,
    async findClip(clipId) {
      const [clip] = await getDb().select().from(clips).where(eq(clips.id, clipId)).limit(1);
      return clip ?? null;
    },
    deleteClipObjects,
    async deleteRows(clipId) {
      await getDb().transaction(async (tx) => {
        await tx.delete(clipTags).where(eq(clipTags.clipId, clipId));
        await tx.delete(clips).where(eq(clips.id, clipId));
      });
    },
    revalidate: revalidatePublicContent,
  });

  return NextResponse.json(result.body, { status: result.status });
}
