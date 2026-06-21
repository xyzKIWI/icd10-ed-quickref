# Body Map Visual Handoff

Date: 2026-06-21

## User Intent

The trauma body map should behave like a clean medical line drawing:

- All clickable body zones should look visually consistent by default.
- Hands should not have persistent blue circles or a style that differs from the trunk/limbs.
- A zone should visibly change color when the mouse hovers over it.
- Clicking should remain the action that applies the query, updates ICD prefix filtering, and collapses the picker.

## Current Implementation

Main source file:

```text
src/template.html
```

Generated files:

```text
dist/icd_ed.html
index.html
```

The interactive body map is inline SVG. Each clickable region is a `.zone` element with `data-part` and `data-side` attributes. The visual behavior is CSS-only:

```css
.zone {
  fill: var(--zone);
  stroke: var(--body-line);
  stroke-width: 1.1;
  opacity: .30;
}

.zone:hover {
  fill: var(--zoneOn);
  stroke: var(--accent);
  stroke-width: 2.5;
  opacity: .86;
}

.zone.on {
  fill: var(--zoneOn);
  stroke: var(--accent);
  stroke-width: 2.2;
  opacity: .80;
}
```

There is intentionally no hand-specific default style now. Hands use the same `.zone` styling as other regions.

## Why Imagen Is Reference Only

An Imagen reference mockup was generated during this pass to clarify the desired look: uniform pale medical zones by default, one hovered region in clinical blue, no persistent hand emphasis.

Do not replace the SVG with a generated bitmap unless the product direction changes. The current app depends on precise SVG hit targets for `data-part -> ICD prefix` logic.

## Build And Test

After editing `src/template.html`:

```bash
python3 src/build_html.py
cp dist/icd_ed.html index.html
node src/test_search.js
```

Expected regression result:

```text
75/75 通過
```

## Visual Check

Open:

```text
file:///Users/kiwi/kiwi_cc/icd10-ed-tool/index.html
```

Then click `外傷小人圖` and hover body regions. Expected:

- Default: subtle pale zones, including hands.
- Hover: only the region under the mouse turns blue.
- Click: selected region remains blue and query is applied.

Recent visual snapshots live in:

```text
docs/visual-checks/
```
