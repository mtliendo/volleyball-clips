import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clips } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import {
  verifyWebhookSignature,
  type TranscodeWebhookPayload,
} from "@/lib/webhook";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-webhook-signature");

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  let payload: TranscodeWebhookPayload;
  try {
    payload = JSON.parse(body) as TranscodeWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.clipId || (payload.status !== "ready" && payload.status !== "failed")) {
    return NextResponse.json({ error: "clipId and status are required" }, { status: 400 });
  }

  const patch: {
    status: "ready" | "failed";
    originalKey?: string;
    playbackKey?: string | null;
    posterKey?: string | null;
    durationMs?: number | null;
  } = { status: payload.status };

  if (payload.originalKey) {
    patch.originalKey = payload.originalKey;
  }
  if (payload.status === "ready") {
    patch.playbackKey = payload.playbackKey ?? null;
    patch.posterKey = payload.posterKey ?? null;
    patch.durationMs = payload.durationMs ?? null;
  } else {
    patch.playbackKey = null;
    patch.posterKey = null;
  }

  const [clip] = await getDb()
    .update(clips)
    .set(patch)
    .where(eq(clips.id, payload.clipId))
    .returning();

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, clipId: clip.id, status: clip.status });
}
