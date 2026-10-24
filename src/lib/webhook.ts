import { createHmac, timingSafeEqual } from "node:crypto";

export type TranscodeWebhookPayload = {
  clipId: string;
  status: "ready" | "failed";
  originalKey?: string;
  playbackKey?: string;
  posterKey?: string;
  durationMs?: number;
  error?: string;
};

export function signWebhookBody(body: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyWebhookSignature(body: string, signature: string | null) {
  const secret = process.env.TRANSCODE_WEBHOOK_SECRET;
  if (!secret || !signature) {
    return false;
  }

  const expected = signWebhookBody(body, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
