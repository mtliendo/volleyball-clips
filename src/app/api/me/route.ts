import { NextResponse } from "next/server";
import { getViewer } from "@/lib/entitlements";
import { listFavoriteClipIds } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  const favoriteClipIds =
    viewer.appUserId ? await listFavoriteClipIds(viewer.appUserId) : [];

  return NextResponse.json({ viewer, favoriteClipIds });
}
