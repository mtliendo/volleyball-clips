import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { isDatabaseConfigured } from "@/lib/env";
import { isUuid } from "@/lib/ids";
import { PinError, parsePinLabel, setClipSessionPin } from "@/lib/session-pins";

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
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { label?: unknown };

  try {
    const label = parsePinLabel(body.label);
    const result = await setClipSessionPin(id, label);
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    if (cause instanceof PinError) {
      return NextResponse.json({ error: cause.message }, { status: cause.status });
    }
    throw cause;
  }
}
