import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { clips, games } from "@/lib/db/schema";
import { isDatabaseConfigured, isS3Configured } from "@/lib/env";
import { omitOriginalKey } from "@/lib/clip-public";
import { assertUploadAllowed, originalKey, presignPut } from "@/lib/s3";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured() || !isS3Configured()) {
    return NextResponse.json(
      { error: "Uploads need DATABASE_URL and AWS S3 env vars" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    gameId?: string;
    filename?: string;
    contentType?: string;
    size?: number;
  };

  if (!body.gameId || !body.filename || typeof body.size !== "number") {
    return NextResponse.json(
      { error: "gameId, filename, and size are required" },
      { status: 400 },
    );
  }

  let contentType: string;
  try {
    contentType = assertUploadAllowed({
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid upload" },
      { status: 400 },
    );
  }

  const [game] = await getDb()
    .select({ id: games.id })
    .from(games)
    .where(eq(games.id, body.gameId))
    .limit(1);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const clipId = randomUUID();
  const key = originalKey(game.id, clipId, body.filename);

  const [clip] = await getDb()
    .insert(clips)
    .values({
      id: clipId,
      gameId: game.id,
      originalKey: key,
      status: "uploading",
    })
    .returning();

  const uploadUrl = await presignPut({
    key,
    contentType,
    size: body.size,
  });

  return NextResponse.json({
    uploadUrl,
    contentType,
    clip: omitOriginalKey(clip),
  });
}
