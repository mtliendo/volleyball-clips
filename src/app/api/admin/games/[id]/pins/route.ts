import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import {
  MAX_PINS_PER_SESSION,
  clips,
  sessionPins,
  type PinLabel,
} from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import { isUuid } from "@/lib/ids";
import { PIN_LABEL_COPY } from "@/lib/labels";
import { getGameWithVenue } from "@/lib/queries";

const LABELS = new Set(Object.keys(PIN_LABEL_COPY));

type PinInput = {
  clipId?: string;
  label?: string | null;
};

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
  if (!isUuid(id) || !(await getGameWithVenue(id))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { pins?: PinInput[] };
  const pins = Array.isArray(body.pins) ? body.pins : [];
  if (pins.length > MAX_PINS_PER_SESSION) {
    return NextResponse.json(
      { error: `At most ${MAX_PINS_PER_SESSION} pins per session` },
      { status: 400 },
    );
  }

  const clipIds = pins.map((pin) => pin.clipId).filter((value): value is string => Boolean(value));
  if (new Set(clipIds).size !== clipIds.length) {
    return NextResponse.json({ error: "A clip can only be pinned once" }, { status: 400 });
  }

  const labels = pins
    .map((pin) => pin.label)
    .filter((value): value is string => Boolean(value));
  if (new Set(labels).size !== labels.length) {
    return NextResponse.json({ error: "Each pin label can be used once" }, { status: 400 });
  }
  if (labels.some((label) => !LABELS.has(label))) {
    return NextResponse.json({ error: "Unknown pin label" }, { status: 400 });
  }

  if (clipIds.length > 0) {
    const existing = await getDb()
      .select({ id: clips.id, status: clips.status, gameId: clips.gameId })
      .from(clips)
      .where(eq(clips.gameId, id));
    const ready = new Set(
      existing.filter((clip) => clip.status === "ready").map((clip) => clip.id),
    );
    if (clipIds.some((clipId) => !ready.has(clipId))) {
      return NextResponse.json({ error: "Pins must be ready clips in this session" }, { status: 400 });
    }
  }

  await getDb().transaction(async (tx) => {
    await tx.delete(sessionPins).where(eq(sessionPins.gameId, id));
    if (clipIds.length > 0) {
      await tx.insert(sessionPins).values(
        pins
          .filter((pin): pin is PinInput & { clipId: string } => Boolean(pin.clipId))
          .map((pin, position) => ({
            gameId: id,
            clipId: pin.clipId,
            label: (pin.label as PinLabel | null | undefined) ?? null,
            position,
          })),
      );
    }
  });

  return NextResponse.json({ ok: true });
}
