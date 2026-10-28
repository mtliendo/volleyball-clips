# Design: VB POV

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: editorial
- Shape of the first page: night-court calendar into 9:16 grid
- Theme: custom (vibe: "dark loud mobile volleyball")
- Axes: dark/display-condensed/chromatic-red · posture: committed
- Hallmark: craft only (tokens, type scale, spacing, focus, reduced motion, no tracked-caps labels)
- Inspo: visual source. Synthesize. Do not clone a site, and do not look like Hassan’s own work.

## Tokens
`src/app/tokens.css` is the source of truth. The roles:

```css
:root {
  --color-paper: oklch(16% 0.018 18);
  --color-paper-2: oklch(20% 0.022 18);
  --color-paper-3: oklch(25% 0.026 18);
  --color-ink: oklch(96% 0.012 88);
  --color-accent: oklch(62% 0.22 25);
  --color-accent-ink: oklch(16% 0.04 20);
  --color-spark: oklch(88% 0.18 118);
  --font-display: "Tektur", sans-serif;
  --font-body: "Onest", sans-serif;
  --radius-card: 8px;
}
```

## Inspo map
Composition only. Palettes and type are rewritten for a night gym.

- **generalcondition-com** · home type slam and electric red signal on a dark field. No grid paper, no cartoons.
- **beardmeatsfood-co-uk** · display size and spark lime reserved for pins and Pro. No comic marks.
- **mikkisindhunata-com** · type over a photographic stage. Here the stage is a staggered rack of real 9:16 posters.
- **music-youtube-com** · dark discovery grid and filter chips. Cells stay 9:16, not squares.
- **artek-fi** · Pro as the featured product in the pricing set.
- **audius-co** · quiet dark stacks for Guest and Free.
- **audocph-com** · the originals strip on the Pro card (`~1400 × 1900 at 120 fps`).

## Controls
- Primary: accent fill · 8px · 44px
- Secondary: rule outline · same radius and height
- Spark: lime fill for Pro and pin labels only

## Motion
- Character: still; tape pauses on hover; feed snaps. Under reduced motion the tape stops.

## Exports
`src/app/tokens.css` in this project.
