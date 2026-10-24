import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import { slugify } from "@/lib/labels";

export async function GET() {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  return NextResponse.json(await getDb().select().from(tags));
}

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { name?: string; slug?: string };
  const name = body.name?.trim();
  const slug = slugify(body.slug || name || "");
  if (!name || !slug) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const [tag] = await getDb().insert(tags).values({ name, slug }).returning();
    return NextResponse.json(tag, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
  }
}
