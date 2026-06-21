# Body Map Hover And Hand Visual Design

Date: 2026-06-21

## Goal

Make the trauma body map feel responsive before click by strengthening hover feedback, and make both hand targets visibly distinct as bold circles.

## Current State

- The body map already has `.zone:hover`, but the default and hover opacity are subtle enough that the interaction can feel like it only responds after click.
- The hand targets are two ordinary ellipses with the same light stroke behavior as other zones.
- Existing click behavior is correct: click selects a zone, applies ICD prefix filtering, updates the query, and collapses the large body map.
- Baseline screenshots were saved at:
  - `docs/visual-checks/2026-06-21-body-map-before.png`
  - `docs/visual-checks/2026-06-21-body-map-before-hover-hand.png`

## Design

- Keep all query, side, fracture refine, and click-selection logic unchanged.
- Strengthen `.zone:hover` so the hovered region changes color and outline before click.
- Keep `.zone.on` as the selected state after click.
- Add a dedicated `data-part="hand"` visual rule so both hands have a persistent bold circular outline.
- Make the hand hover/selected state slightly stronger than other zones while preserving the same clickable SVG elements.

## Verification

- Rebuild `dist/icd_ed.html` from `src/template.html`.
- Copy rebuilt output to root `index.html`.
- Run `node src/test_search.js`.
- Use browser screenshots to compare before and after, including right-hand hover.
