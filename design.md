# Design: VB POV

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: editorial
- Shape of the first page: night-court calendar into 9:16 grid
- Theme: custom (vibe: "dark loud mobile volleyball")
- Axes: dark/display-condensed/chromatic-red · posture: committed

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

Visual notes (Inspo as source, Hallmark for craft): General Condition’s electric red on a dark grid informed the accent and the poster rail; Beard Meats Food’s high-contrast roar informed the display size and charcoal night; Artek’s featured pricing block informed the Pro card; Audius’s simple dark stacks informed Guest and Free; Audocph’s highlighted strip informed the originals callout.

## Controls
- Primary: accent fill · 8px · 44px
- Secondary: rule outline · same radius and height
- Spark: lime fill for Pro and pin labels only

## Motion
- Character: still; tape pauses on hover; feed snaps. Under reduced motion the tape stops.

## Exports
`src/app/tokens.css` in this project.
