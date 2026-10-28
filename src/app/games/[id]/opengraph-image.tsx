import { GAME_TYPE_LABELS } from "@/lib/labels";
import { formatGameWhen } from "@/lib/dates";
import { renderOgCard } from "@/lib/og/render";
import { getSessionShare, publicPosterUrl } from "@/lib/share-metadata";
import { SITE_DESCRIPTION } from "@/lib/site";

export const alt = "VB POV session";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const share = await getSessionShare(id);
  if (!share) {
    return renderOgCard({
      eyebrow: "From the glasses",
      title: "Clips from the glasses",
      detail: SITE_DESCRIPTION,
    });
  }

  const clips = share.clipCount === 1 ? "1 clip" : `${share.clipCount} clips`;
  return renderOgCard({
    eyebrow: GAME_TYPE_LABELS[share.type],
    title: share.venueName,
    detail: `${formatGameWhen(share.startsAt)} · ${clips}`,
    posterSrc: publicPosterUrl(share.posterKey) || null,
  });
}
