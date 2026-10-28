import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/admin";
import { cdnUrl } from "@/lib/cdn";
import { FREE_DOWNLOADS_PER_WEEK } from "@/lib/db/schema";
import { hasProAccess } from "@/lib/entitlements";
import { isDatabaseConfigured } from "@/lib/env";
import { countDownloadsThisWeek, recordDownload } from "@/lib/limits";
import { getReadyClip } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { ensureAppUser } from "@/lib/users";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireUserApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const clip = await getReadyClip(id);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const appUser = await ensureAppUser(session.user);
  if (!appUser) {
    return NextResponse.json({ error: "Could not save account" }, { status: 503 });
  }

  const admin = isAdmin(session.user);
  const pro = admin || hasProAccess(appUser);
  const quality = pro ? "original" : "playback";
  const key = pro ? clip.originalKey : clip.playbackKey;
  const url = cdnUrl(key);

  if (!url) {
    return NextResponse.json({ error: "Download is not available yet" }, { status: 409 });
  }

  if (!pro) {
    const used = await countDownloadsThisWeek(appUser.id);
    if (used >= FREE_DOWNLOADS_PER_WEEK) {
      return NextResponse.json(
        {
          error: "Weekly download limit reached",
          remaining: 0,
          upgrade: true,
        },
        { status: 402 },
      );
    }
  }

  await recordDownload({
    userId: appUser.id,
    clipId: clip.id,
    quality,
  });

  return NextResponse.redirect(url);
}
