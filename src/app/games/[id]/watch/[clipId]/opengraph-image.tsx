import { formatGameWhen } from "@/lib/dates";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { renderOgCard } from "@/lib/og/render";
import { listReadyWatchParams } from "@/lib/queries";
import { getClipShare, publicPosterUrl } from "@/lib/share-metadata";
import { SITE_DESCRIPTION } from "@/lib/site";

export const alt = "VB POV clip";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";
export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    return await listReadyWatchParams();
  } catch {
    return [];
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}) {
  const { id, clipId } = await params;
  const share = await getClipShare(id, clipId);
  if (!share) {
    return renderOgCard({
      eyebrow: "From the glasses",
      title: "Clips from the glasses",
      detail: SITE_DESCRIPTION,
    });
  }

  return renderOgCard({
    eyebrow: GAME_TYPE_LABELS[share.type],
    title: share.venueName,
    detail: `A clip · ${formatGameWhen(share.startsAt)}`,
    posterSrc: publicPosterUrl(share.posterKey) || null,
  });
}
