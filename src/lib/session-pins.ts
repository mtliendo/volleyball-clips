import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { MAX_PINS_PER_SESSION, sessionPins, type PinLabel } from "./db/schema";
import { getReadyClip } from "./queries";
import { PIN_LABEL_COPY } from "./labels";

const LABELS = new Set(Object.keys(PIN_LABEL_COPY));

export class PinError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function parsePinLabel(value: unknown): PinLabel | null {
  if (value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !LABELS.has(value)) {
    throw new PinError("Unknown pin label", 400);
  }
  return value as PinLabel;
}

export async function setClipSessionPin(clipId: string, label: PinLabel | null) {
  const clip = await getReadyClip(clipId);
  if (!clip) {
    throw new PinError("Clip not found", 404);
  }

  const existing = await getDb()
    .select()
    .from(sessionPins)
    .where(eq(sessionPins.gameId, clip.gameId));

  const current = existing.find((pin) => pin.clipId === clipId);
  const holder = label
    ? existing.find((pin) => pin.label === label && pin.clipId !== clipId)
    : undefined;

  if (label && !current && existing.length >= MAX_PINS_PER_SESSION && !holder) {
    throw new PinError(`At most ${MAX_PINS_PER_SESSION} pins per session`, 400);
  }

  let next = existing.filter((pin) => pin.clipId !== clipId);
  if (holder) {
    next = next.filter((pin) => pin.clipId !== holder.clipId);
  }
  if (label) {
    next.push({
      gameId: clip.gameId,
      clipId,
      label,
      position: current?.position ?? holder?.position ?? next.length,
    });
  }

  next = next
    .sort((a, b) => a.position - b.position)
    .map((pin, position) => ({ ...pin, position }));

  await getDb().transaction(async (tx) => {
    await tx.delete(sessionPins).where(eq(sessionPins.gameId, clip.gameId));
    if (next.length > 0) {
      await tx.insert(sessionPins).values(next);
    }
  });

  return {
    gameId: clip.gameId,
    clipId,
    label,
    movedFromClipId: holder?.clipId ?? null,
    pins: next,
  };
}
