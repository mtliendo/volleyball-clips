import { NextResponse } from "next/server";
import { isUuid } from "@/lib/ids";
import { revalidatePublicContent } from "@/lib/public-cache";
import { verifyWebhookSignature } from "@/lib/webhook";

export const dynamic = "force-dynamic";

function bearerMatches(request: Request) {
  const secret = process.env.TRANSCODE_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signed = verifyWebhookSignature(body, request.headers.get("x-webhook-signature"));
  if (!signed && !bearerMatches(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { gameId?: unknown; clipId?: unknown; all?: unknown } = {};
  if (body) {
    try {
      payload = JSON.parse(body) as { gameId?: unknown; clipId?: unknown; all?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const gameId = typeof payload.gameId === "string" && isUuid(payload.gameId) ? payload.gameId : undefined;
  const clipId = typeof payload.clipId === "string" && isUuid(payload.clipId) ? payload.clipId : undefined;
  const all = payload.all === true;

  revalidatePublicContent({ gameId, clipId, all });
  return NextResponse.json({ ok: true });
}
