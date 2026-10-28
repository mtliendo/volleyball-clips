import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/admin";
import { originalObjectUrl, playbackObjectUrl } from "@/lib/cloudfront-sign";
import { FREE_DOWNLOADS_PER_WEEK } from "@/lib/db/schema";
import {
  DOWNLOADS_REMAINING_HEADER,
  VERIFY_DOWNLOADS_COOKIE,
  contentDispositionAttachment,
  downloadFilename,
} from "@/lib/download";
import { hasProAccess } from "@/lib/entitlements";
import { isDatabaseConfigured } from "@/lib/env";
import {
  countDownloadsThisWeek,
  hasRecentDownload,
  nextDownloadAtFromOldest,
  oldestDownloadThisWeek,
  recordDownload,
} from "@/lib/limits";
import { getReadyClip } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { ensureAppUser } from "@/lib/users";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function limitBody(nextAt: string | null = null) {
  return {
    error: "Weekly download limit reached",
    remaining: 0,
    upgrade: true,
    nextAt,
  };
}

function attachmentResponse(
  body: BodyInit,
  input: {
    filename: string;
    remaining: number | null;
    contentType?: string | null;
    contentLength?: string | null;
  },
) {
  const headers = new Headers();
  headers.set("Content-Type", input.contentType || "video/mp4");
  headers.set("Content-Disposition", contentDispositionAttachment(input.filename));
  headers.set("Cache-Control", "private, no-store");
  if (input.remaining !== null) {
    headers.set(DOWNLOADS_REMAINING_HEADER, String(input.remaining));
  }
  if (input.contentLength) {
    headers.set("Content-Length", input.contentLength);
  }
  return new NextResponse(body, { status: 200, headers });
}

async function verifyHarnessDownload(id: string) {
  const jar = await cookies();
  const stored = Number(jar.get(VERIFY_DOWNLOADS_COOKIE)?.value ?? "3");
  const remaining = Number.isFinite(stored) ? stored : 3;
  if (remaining <= 0) {
    const nextAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    return NextResponse.json(limitBody(nextAt), { status: 402 });
  }

  const next = remaining - 1;
  const response = attachmentResponse(Buffer.from("vbpov-verify-clip\n"), {
    filename: downloadFilename({
      id,
      originalKey: "clip.mp4",
      quality: "playback",
    }),
    remaining: next,
    contentType: "video/mp4",
  });
  response.cookies.set(VERIFY_DOWNLOADS_COOKIE, String(next), { path: "/" });
  return response;
}

function parseQuality(
  request: Request,
  pro: boolean,
): "original" | "playback" | NextResponse {
  const requested = new URL(request.url).searchParams.get("quality");
  if (requested && requested !== "original" && requested !== "playback") {
    return NextResponse.json({ error: "Invalid quality" }, { status: 400 });
  }
  if (requested === "original" && !pro) {
    return NextResponse.json(
      { error: "Original downloads require Pro" },
      { status: 403 },
    );
  }
  if (requested === "playback") {
    return "playback";
  }
  return pro ? "original" : "playback";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (process.env.VERIFY_FEED_HARNESS === "1") {
    return verifyHarnessDownload(id);
  }

  const { session, error } = await requireUserApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

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
  const quality = parseQuality(request, pro);
  if (quality instanceof NextResponse) {
    return quality;
  }
  const key = quality === "original" ? clip.originalKey : clip.playbackKey;
  const filename = downloadFilename({
    id: clip.id,
    originalKey: clip.originalKey,
    quality,
  });

  let url = "";
  try {
    if (!key) {
      url = "";
    } else if (quality === "original") {
      url = originalObjectUrl(key);
    } else {
      url = playbackObjectUrl(key);
    }
  } catch (err) {
    console.error("download origin url failed", err);
    return NextResponse.json({ error: "Download is not available yet" }, { status: 503 });
  }

  if (!url) {
    return NextResponse.json({ error: "Download is not available yet" }, { status: 409 });
  }

  const event = { userId: appUser.id, clipId: clip.id, quality } as const;
  const recent = await hasRecentDownload(event);

  if (!pro && !recent) {
    const used = await countDownloadsThisWeek(appUser.id);
    if (used >= FREE_DOWNLOADS_PER_WEEK) {
      const oldest = await oldestDownloadThisWeek(appUser.id);
      const next = nextDownloadAtFromOldest(oldest);
      return NextResponse.json(limitBody(next ? next.toISOString() : null), { status: 402 });
    }
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Download is not available yet" }, { status: 409 });
  }

  if (!recent) {
    await recordDownload(event);
  }

  const remaining = pro
    ? null
    : Math.max(0, FREE_DOWNLOADS_PER_WEEK - (await countDownloadsThisWeek(appUser.id)));

  return attachmentResponse(upstream.body, {
    filename,
    remaining,
    contentType: upstream.headers.get("content-type"),
    contentLength: upstream.headers.get("content-length"),
  });
}
