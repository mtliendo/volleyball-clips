import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { VerticalFeed } from "@/components/vertical-feed";
import { parseYearMonth } from "@/lib/dates";
import type { PinLabel } from "@/lib/db/schema";
import type { Viewer } from "@/lib/entitlements";
import { PIN_LABEL_COPY } from "@/lib/labels";
import { listGameClips, listMonthGames, listTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

const PIN_COOKIE = "vb_verify_pins";
const PLAY_COOKIE = "vb_verify_play_tags";

function viewerFor(role: string | undefined): Viewer {
  const admin = role === "admin";
  return {
    signedIn: true,
    isAdmin: admin,
    isPro: false,
    watchUnlimited: true,
    canFavorite: true,
    canDownload: false,
    downloadsRemaining: null,
    stripeReady: false,
    authReady: true,
    email: "verify@vbpov.test",
    name: "Verify",
    appUserId: null,
  };
}

function readJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default async function VerifyFeedAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; tag?: string }>;
}) {
  await connection();
  if (process.env.VERIFY_FEED_HARNESS !== "1") {
    notFound();
  }

  const { as, tag } = await searchParams;
  const games = await listMonthGames(parseYearMonth("2026-10"));
  const game = games.find((item) => item.readyClipCount >= 3);
  if (!game) {
    notFound();
  }

  const [clips, catalogTags] = await Promise.all([
    listGameClips(game.id, { readyOnly: true }),
    listTags(),
  ]);
  if (clips.length < 3) {
    notFound();
  }

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
      tags: catalogTags.filter((item) => slugs?.includes(item.slug)),
    };
  });

  const filtered = tag
    ? tagged.filter((clip) => clip.tags.some((item) => item.slug === tag))
    : tagged;

  if (filtered.length === 0) {
    return (
      <div className="feed-root grid place-items-center px-4" data-filter-empty={tag ?? ""}>
        <p className="text-sm text-muted">No clips match that tag.</p>
      </div>
    );
  }

  return (
    <VerticalFeed
      clips={filtered}
      startId={filtered[0].id}
      gameId={game.id}
      tag={tag ?? null}
      catalogTags={catalogTags}
      viewer={viewerFor(as)}
      closeHref={`/games/${game.id}`}
    />
  );
}
