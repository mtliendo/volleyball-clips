import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export const PUBLIC_REVALIDATE_SECONDS = 900;

export const PUBLIC_CACHE_TAGS = {
  home: "public-home",
  games: "public-games",
} as const;

export function revalidatePublicContent(input?: {
  gameId?: string;
  clipId?: string;
  all?: boolean;
}) {
  revalidateTag(PUBLIC_CACHE_TAGS.home, "max");
  revalidateTag(PUBLIC_CACHE_TAGS.games, "max");
  revalidatePath("/");

  if (input?.all || !input?.gameId) {
    revalidatePath("/", "layout");
    return;
  }

  revalidatePath(`/games/${input.gameId}`);
  revalidatePath(`/games/${input.gameId}`, "layout");
  if (input.clipId) {
    revalidatePath(`/games/${input.gameId}/watch/${input.clipId}`);
  }
}
