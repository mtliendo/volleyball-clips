import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { favorites } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import { getReadyClip } from "@/lib/queries";
import { ensureAppUser } from "@/lib/users";

export async function POST(request: Request) {
  const { session, error } = await requireUserApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const appUser = await ensureAppUser(session.user);
  if (!appUser) {
    return NextResponse.json({ error: "Could not save account" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { clipId?: string };
  if (!body.clipId) {
    return NextResponse.json({ error: "clipId is required" }, { status: 400 });
  }

  const clip = await getReadyClip(body.clipId);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const [existing] = await getDb()
    .select()
    .from(favorites)
    .where(and(eq(favorites.userId, appUser.id), eq(favorites.clipId, clip.id)))
    .limit(1);

  if (existing) {
    await getDb()
      .delete(favorites)
      .where(and(eq(favorites.userId, appUser.id), eq(favorites.clipId, clip.id)));
    return NextResponse.json({ favorited: false });
  }

  await getDb().insert(favorites).values({ userId: appUser.id, clipId: clip.id });
  return NextResponse.json({ favorited: true });
}
