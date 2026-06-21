# Body Map Hover Hand Visual Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. If the current agent supports subagents, use a fresh subagent per task with review between tasks. Otherwise execute inline with checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen trauma body map hover feedback and draw both hand targets as bold circles.

**Architecture:** This is a visual-only change in the existing single-file frontend template. CSS selectors target existing SVG `.zone` elements, with a narrower rule for `data-part="hand"`; JavaScript click/query logic remains untouched.

**Tech Stack:** HTML, CSS, inline SVG, existing Python HTML build script, Node regression tests.

---

### Task 1: Record Baseline

**Files:**
- Create: `docs/visual-checks/2026-06-21-body-map-before.png`
- Create: `docs/visual-checks/2026-06-21-body-map-before-hover-hand.png`

- [x] **Step 1: Save expanded body map screenshot**

Run browser automation against:

```text
file:///Users/kiwi/kiwi_cc/icd10-ed-tool/index.html
```

Save:

```text
docs/visual-checks/2026-06-21-body-map-before.png
```

- [x] **Step 2: Save right-hand hover screenshot**

Hover the first right-hand zone:

```css
.zone[data-part="hand"][data-side="right"]
```

Save:

```text
docs/visual-checks/2026-06-21-body-map-before-hover-hand.png
```

### Task 2: Apply Visual CSS

**Files:**
- Modify: `src/template.html`

- [x] **Step 1: Add stronger hover and selected rules**

Change the `.zone` rules so hover has stronger fill/outline, selected state remains visible, and hand targets have a bold default outline.

- [x] **Step 2: Preserve logic**

Do not change the `.zone` click event handler, `ANATOMICAL_MAP`, side mode, fracture refinement, or search core.

### Task 3: Rebuild And Verify

**Files:**
- Modify: `dist/icd_ed.html`
- Modify: `index.html`
- Create: `docs/visual-checks/2026-06-21-body-map-after.png`
- Create: `docs/visual-checks/2026-06-21-body-map-after-hover-hand.png`

- [x] **Step 1: Rebuild dist**

Run:

```bash
python3 src/build_html.py
```

Expected: `dist/icd_ed.html` is regenerated.

- [x] **Step 2: Update root HTML**

Copy:

```bash
cp dist/icd_ed.html index.html
```

- [x] **Step 3: Run regression tests**

Run:

```bash
node src/test_search.js
```

Expected: all guard tests pass.

- [x] **Step 4: Capture after screenshots**

Save:

```text
docs/visual-checks/2026-06-21-body-map-after.png
docs/visual-checks/2026-06-21-body-map-after-hover-hand.png
```

Expected: hover appears before click, and both hand targets have clear bold circles.

Completed screenshots:

```text
docs/visual-checks/2026-06-21-body-map-after.png
docs/visual-checks/2026-06-21-body-map-after-hover-hand.png
docs/visual-checks/2026-06-21-body-map-after-dark-hover-hand.png
```
