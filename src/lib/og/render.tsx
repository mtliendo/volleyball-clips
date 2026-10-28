import { ImageResponse } from "next/og";
import { loadOgFonts } from "./fonts";
import { ogTheme } from "./theme";
import { OG_SIZE } from "@/lib/site";

export type OgCard = {
  eyebrow: string;
  title: string;
  detail: string;
  posterSrc?: string | null;
};

function ClipMark({ size = 220 }: { size?: number }) {
  const width = Math.round(size * (9 / 16));
  return (
    <div
      style={{
        display: "flex",
        width,
        height: size,
        borderRadius: 12,
        background: ogTheme.accent,
      }}
    />
  );
}

function words(text: string, fontSize: number) {
  const gap = Math.max(8, Math.round(fontSize * 0.32));
  return text.split(/\s+/).filter(Boolean).map((word, index) => (
    <span
      key={`${word}-${index}`}
      style={{
        display: "flex",
        paddingLeft: index === 0 ? 0 : gap,
      }}
    >
      {word}
    </span>
  ));
}

export async function renderOgCard(card: OgCard) {
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: ogTheme.paper,
          color: ogTheme.ink,
          fontFamily: "Onest",
        }}
      >
        <div
          style={{
            width: 16,
            height: "100%",
            background: ogTheme.accent,
          }}
        />
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "56px 64px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: card.posterSrc ? 680 : 820,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontFamily: "Tektur",
                fontSize: 28,
                color: ogTheme.ink,
                marginBottom: 28,
              }}
            >
              {words("VB POV", 28)}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontSize: 22,
                color: ogTheme.muted,
                marginBottom: 16,
              }}
            >
              {words(card.eyebrow, 22)}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontFamily: "Tektur",
                fontSize: card.title.length > 28 ? 56 : 72,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
              }}
            >
              {words(card.title, card.title.length > 28 ? 56 : 72)}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                marginTop: 22,
                fontSize: 26,
                color: ogTheme.ink2,
                lineHeight: 1.35,
              }}
            >
              {words(card.detail, 26)}
            </div>
          </div>
          {card.posterSrc ? (
            <div
              style={{
                display: "flex",
                width: 252,
                height: 448,
                borderRadius: 8,
                overflow: "hidden",
                background: ogTheme.paper3,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.posterSrc}
                alt=""
                width={252}
                height={448}
                style={{ objectFit: "cover" }}
              />
            </div>
          ) : (
            <ClipMark size={360} />
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
    },
  );
}

export { OG_SIZE };
