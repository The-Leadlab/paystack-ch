# Personal ↔ Business visual parity — super prompt

## Goal

Make `/personal` look like `/app` Business: same color system, font, tab/nav treatment, and collapsed-rail button chrome. Personal must feel like the same product, not a separate “wealth” pink theme.

## Source of truth

Business (`client/src/cafe/businessApp.css` + CDLP tokens in `client/src/index.css`):

- Canvas `#1a1d23`, surface `#252a31`, border `#3a4048`, text white, muted `#c5cad1`
- Accent / CTA: `--color-cdlp-gold` (`#e8423f`)
- Font: `--font-app` (Inter), uppercase micro-labels, tabular nums
- Nav: muted uppercase links, active = left white/gold border + subtle gray fill (not filled pink pill)
- Rail: 3.5rem, centered icon buttons, bordered action chips

## Changes

1. Remap `.personal-plan-shell` `--pp-*` tokens onto Business / CDLP values (dark + light).
2. Switch Personal font from Sora (`--font-sans`) to `--font-app` (Inter).
3. Restyle Personal sidebar nav to Business nav pattern (`pp-nav-btn`): uppercase, tracking, left-border active.
4. Collapsed rail: match Business action/link chip borders (accent red outline for primary actions; muted border for secondary).
5. KPI / cards: tighter radius (`0.5rem`), Business surface/border colors; labels like `.ba-kpi-label`.
6. Mobile bottom tabs: same uppercase micro style + active treatment as Business mobile bar.

## Out of scope

Changing Business tokens; Open Banking; promoting Ali lab features.
