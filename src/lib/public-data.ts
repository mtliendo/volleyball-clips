import "server-only";

import { unstable_cache } from "next/cache";
import { parseYearMonth, yearMonthKey } from "./dates";
import { PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS } from "./public-cache";
import {
  getGameWithVenue,
  listGameClips,
  listMonthGames,
  listRecentReadyPosters,
  listTags,
  type PublicClip,
  type PublicGame,
} from "./queries";

function reviveGame(game: PublicGame): PublicGame {
  return {
    ...game,
    startsAt: new Date(game.startsAt),
  };
}

function reviveClip(clip: PublicClip): PublicClip {
  return {
    ...clip,
    createdAt: new Date(clip.createdAt),
    favorited: false,
    ai: clip.ai
      ? {
          ...clip.ai,
          taggedAt: clip.ai.taggedAt ? new Date(clip.ai.taggedAt) : null,
        }
      : null,
  };
}

export async function getCachedMonthGames(ym?: string) {
  const key = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : yearMonthKey(parseYearMonth());
  const games = await unstable_cache(
    async () => listMonthGames(parseYearMonth(key)),
    ["public-month", key],
    {
      revalidate: PUBLIC_REVALIDATE_SECONDS,
      tags: [PUBLIC_CACHE_TAGS.home],
    },
  )();
  return { ym: key, games: games.map(reviveGame) };
}

export async function getCachedRecentPosters(limit = 6) {
  const posters = await unstable_cache(
    async () => listRecentReadyPosters(limit),
    ["public-posters", String(limit)],
    {
      revalidate: PUBLIC_REVALIDATE_SECONDS,
      tags: [PUBLIC_CACHE_TAGS.home],
    },
  )();
  return posters;
}

export async function getCachedGameWithVenue(gameId: string) {
  const game = await unstable_cache(
    async () => getGameWithVenue(gameId),
    ["public-game", gameId],
    {
      revalidate: PUBLIC_REVALIDATE_SECONDS,
      tags: [PUBLIC_CACHE_TAGS.games, `public-game-${gameId}`],
    },
  )();
  if (!game) return null;
  return { ...game, startsAt: new Date(game.startsAt) };
}

export async function getCachedGameClips(gameId: string) {
  const clips = await unstable_cache(
    async () => listGameClips(gameId, { readyOnly: true }),
    ["public-game-clips", gameId],
    {
      revalidate: PUBLIC_REVALIDATE_SECONDS,
      tags: [PUBLIC_CACHE_TAGS.games, `public-game-${gameId}`],
    },
  )();
  return clips.map(reviveClip);
}

export async function getCachedTags() {
  return unstable_cache(listTags, ["public-tags"], {
    revalidate: PUBLIC_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.games],
  })();
}
