import { renderOgCard } from "@/lib/og/render";
import { SITE_DESCRIPTION } from "@/lib/site";

export const alt = "VB POV — volleyball clips from the glasses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return renderOgCard({
    eyebrow: "From the glasses",
    title: "Clips from the glasses",
    detail: SITE_DESCRIPTION,
  });
}
