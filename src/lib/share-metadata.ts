import type { Metadata } from "next";
import { cdnUrl } from "./cdn";
import { formatGameWhen } from "./dates";
import { GAME_TYPE_LABELS } from "./labels";
import { getGameWithVenue, getReadyClip, listGameClips } from "./queries";
import { OG_SIZE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

export type SessionShare = {
  id: string;
  venueName: string;
  startsAt: Date;
  type: "open_gym" | "league" | "tournament";
  clipCount: number;
  posterKey: string | null;
};

export type ClipShare = {
  id: string;
  gameId: string;
  venueName: string;
  startsAt: Date;
  type: SessionShare["type"];
  posterKey: string | null;
  durationMs: number | null;
};

export function publicPosterUrl(posterKey?: string | null) {
  if (!posterKey || !posterKey.startsWith("posters/")) {
    return "";
  }
  return cdnUrl(posterKey);
}

export async function getSessionShare(gameId: string): Promise<SessionShare | null> {
  const game = await getGameWithVenue(gameId);
  if (!game) return null;

  const clips = await listGameClips(gameId, { readyOnly: true });
  const posterKey =
    clips.find((clip) => clip.posterKey?.startsWith("posters/"))?.posterKey ?? null;

  return {
    id: game.id,
    venueName: game.venueName,
    startsAt: game.startsAt,
    type: game.type,
    clipCount: clips.length,
    posterKey,
  };
}

export async function getClipShare(
  gameId: string,
  clipId: string,
): Promise<ClipShare | null> {
  const game = await getGameWithVenue(gameId);
  if (!game) return null;

  const clip = await getReadyClip(clipId);
  if (!clip || clip.gameId !== gameId) return null;

  return {
    id: clip.id,
    gameId: game.id,
    venueName: game.venueName,
    startsAt: game.startsAt,
    type: game.type,
    posterKey: clip.posterKey?.startsWith("posters/") ? clip.posterKey : null,
    durationMs: clip.durationMs,
  };
}

function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const url = `${SITE_URL}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: input.type ?? "website",
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      title: input.title,
      description: input.description,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}

export function rootMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: "en_US",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function sessionPageMetadata(share: SessionShare): Metadata {
  const when = formatGameWhen(share.startsAt);
  const kind = GAME_TYPE_LABELS[share.type];
  const clips =
    share.clipCount === 1 ? "1 clip" : `${share.clipCount} clips`;
  return pageMetadata({
    title: share.venueName,
    description: `${clips} from ${kind.toLowerCase()} at ${share.venueName}. ${when}.`,
    path: `/games/${share.id}`,
  });
}

export function clipPageMetadata(share: ClipShare): Metadata {
  const when = formatGameWhen(share.startsAt);
  return pageMetadata({
    title: `Clip from ${share.venueName}`,
    description: `A clip from ${share.venueName}. ${when}.`,
    path: `/games/${share.gameId}/watch/${share.id}`,
  });
}

export { OG_SIZE, SITE_DESCRIPTION, SITE_NAME, SITE_URL };
