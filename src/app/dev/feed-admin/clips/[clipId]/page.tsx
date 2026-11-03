import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ClipEditForm } from "@/components/admin/clip-edit-form";
import { parseYearMonth } from "@/lib/dates";
import type { PinLabel } from "@/lib/db/schema";
import { PIN_LABEL_COPY } from "@/lib/labels";
import { listGameClips, listMonthGames, listTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

const PIN_COOKIE = "vb_verify_pins";
const PLAY_COOKIE = "vb_verify_play_tags";

function readJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default async function VerifyFeedAdminClipPage({
  params,
}: {
  params: Promise<{ clipId: string }>;
}) {
  await connection();
  if (process.env.VERIFY_FEED_HARNESS !== "1") {
    notFound();
  }

  const { clipId } = await params;
  const games = await listMonthGames(parseYearMonth("2026-10"));
  const game = games.find((item) => item.readyClipCount >= 3);
  if (!game) {
    notFound();
  }

  const [clips, catalogTags] = await Promise.all([
    listGameClips(game.id, { readyOnly: true }),
    listTags(),
  ]);
  const jar = await cookies();
  const pinMap = readJson<Record<string, PinLabel | null>>(jar.get(PIN_COOKIE)?.value, {});
  const playMap = readJson<Record<string, string[]>>(jar.get(PLAY_COOKIE)?.value, {});

  const tagged = clips.map((clip) => {
    const pinLabel = Object.hasOwn(pinMap, clip.id) ? pinMap[clip.id] : clip.pin?.label;
    const slugs = Object.hasOwn(playMap, clip.id)
      ? playMap[clip.id]
      : clip.tags.map((item) => item.slug);
    return {
      ...clip,
      pin:
        pinLabel && pinLabel in PIN_LABEL_COPY
          ? { label: pinLabel, position: clip.pin?.position ?? 0 }
          : pinLabel === null
            ? null
            : clip.pin,
      tags: catalogTags.filter(
        (item) => slugs?.includes(item.slug) || slugs?.includes(item.id),
      ),
    };
  });
  const clip = tagged.find((item) => item.id === clipId);
  if (!clip) {
    notFound();
  }

  return (
    <div className="container space-y-5 py-6">
      <Link href="/dev/feed-admin?as=admin" className="text-sm text-muted">
        Back to feed
      </Link>
      <h1 className="display text-display-s">Edit clip</h1>
      <ClipEditForm clip={clip} catalogTags={catalogTags} gameId={game.id} />
    </div>
  );
}
