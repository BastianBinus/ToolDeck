# ToolDeck Design Spec

---

## 1. Character
Matte, dark, typographic. A dark index card, not glass. Solid surfaces, thin lines, one warm accent (rust).
The signature is the **1.5px rust line** under labels and the selection.

## 2. Tokens (`src/app.css`, dark only)
```css
:root {
  color-scheme: dark;
  --bg:        #141412;  /* app background */
  --paper:     #1b1a18;  /* text on accent, theme-color */
  --card:      #1f1e1b;  /* cards, dial, selection band */
  --raised:    #26251f;  /* unselected dial items, dividers */
  --line:      #33312c;  /* borders */
  --ink:       #ebe7dd;  /* primary text */
  --muted:     #a19c90;  /* secondary text */
  --faint:     #6f6a60;  /* tertiary text, numbering */
  --accent:    #e0785c;  /* rust: buttons, lines, selection */
  --accent-soft:#3a2621; /* secondary buttons (Paste, Copy) */
  --on-accent: #1b1a18;
  --warn:      #e8bd72;  /* invalid input */
  --sans: "IBM Plex Sans", -apple-system, system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --gutter: max(20px, env(safe-area-inset-left));
}
```
Update `theme-color` in `index.html` and `background_color`/`theme_color` in the manifest to `#141412`.

## 3. Typography
| Use | Font | Size / weight | Tracking |
|---|---|---|---|
| Hero (dial, tool name) | Sans | 46px / 600, lh 1.02 | -0.035em |
| Page title | Sans | 30–34px / 600, lh 1.1 | -0.025em |
| Drum entry | Sans | 22px / 600 | -0.015em |
| Blurb large | Sans | 18–22px / 400–500 | -0.01em |
| Body | Sans | 15px / 400, lh 1.5 | 0 |
| Footnote | Sans | 13px / 400, muted | 0 |
| Label / meta / numbering | Mono | 11–12px / 500 | 0.08em when UPPERCASE |

Numbering is always two digits (`01`, `02`) in mono, in `--faint` or `--accent`.

## 4. Layout & shapes
- Gutter 20px (tool pages 16px). Vertical gap between blocks 20px.
- Radii: cards 14px · inputs/segments/small buttons 10px · selection band 12px · icon tile 13–14px · primary button fully rounded (height 56 → radius 28).
- Borders always 1px `--line`. No shadows except the dial (`0 -20px 50px -20px rgba(0,0,0,.6)`).
- Bottom action button: `position: sticky` in the dock (not fixed, see the deck contract), dock fade `linear-gradient(transparent, var(--bg) 36px)`.

## 5. Components
**Header (home):** brand mark (two stacked cards, 20×16, stroke `--ink` 1.5) + "ToolDeck" 16/600 on the left, picker toggle on the right.

**Picker toggle:** segmented control, container `--card` + border, 3px padding, radius 12. Two 40×32 buttons (radius 9): icons `picker-drum` / `picker-dial` at 18px. Active: background `--ink`, icon `--on-accent`. Remember the choice in `localStorage` (`tooldeck.picker`).

**Tool page nav:** sticky top, background `--bg`, bottom border `#26251f`. Left "‹ Tools" in `--accent` 16/500, right `02 / 04` mono 11 `--faint`. Transition: home slides out to -30%, the tool slides in from 100%, `.42s cubic-bezier(.3,.8,.2,1)`.

**Tool header:** icon tile 48×48 (radius 13, `--accent` background, icon in `--on-accent` at 26px) + title 30/600 + mono subtitle 12 `--muted`.

**Card:** `--card`, border `--line`, radius 14, padding 14/16/16. Meta row at the top in mono 12, separated by a 1.5px `--accent` line.

**Input:** mono 16px (prevents iOS zoom), background `--bg`, border `--line`, radius 10, padding 11/12. Invalid: border `--warn`, meta text `--warn`.

**Segmented (e.g. quality):** one row, border `--line`, radius 10, 1px separators. Active: `--ink` background, `--on-accent` text. Mono 13.

**Buttons:** primary `--accent` / `--on-accent`, 56px, 17/600. Disabled: `#2a2926` / `--faint`. Secondary (Paste, Copy): `--accent-soft` / `--accent`, radius 8–10, 12–14/600.

**Setup disclosure:** mono uppercase label `ONE-TIME SETUP · 4 STEPS` with a › chevron (rotates 90° when open), steps numbered `01…` in mono `--accent`, command box `--card` + border, radius 10.

## 6. Picker wheel (home)
Both variants share the selection (`sel`); switching carries it over.

**Drum**
- Row height 52px, 7 rows visible (364px). Spacer above/below 156px (3 rows).
- `scroll-snap-type: y mandatory`, items `scroll-snap-align: center`, container `perspective: 700px`.
- Per item: `o = (i*52 - scrollTop)/52` → `rotateX(clamp(-o*24deg, ±80deg))`, `opacity = max(.12, 1 - |o|*.3)`.
- Mask: `linear-gradient(transparent, #000 30%, #000 70%, transparent)`.
- Selection band: `--card`, border `--line`, radius 12, rust line along the bottom (`inset 0 -1.5px 0 var(--accent)`).
- Entry: icon 24 (selected `--accent`, otherwise `--faint`), name 22/600, number right-aligned in mono.
- Below: blurb 22/500, note mono 12, button "Open {name}". Tapping the selected entry opens it too.

**Dial**
- Disc 380×380, top at y=500 (partly off the bottom of the screen), `--card` + border.
- 72 ticks every 5°; every 3rd tick 10px long, otherwise 5px; every 18th tick in `--faint`, otherwise `--line`.
- Tools evenly spaced around the circle (360/N°), radius 132, as 64px circles. Selected: `--ink` background, icon `--on-accent`; otherwise `--raised`.
- Centre: "Open" button 120px, `--accent`.
- Rust triangle above the disc marks the selection.
- Interaction: pointer drag (angle from the centre, capture only after 4° of movement so taps still work), scroll wheel as well; on release snap to the nearest multiple of the step, `.45s cubic-bezier(.3,1.3,.5,1)` (slight overshoot). Items counter-rotate so they stay upright.
- Above: mono note + `02 / 04` over a rust line, name 46/600, blurb 18.

Haptics (if the tool is later wrapped as a native app): a light tick on every snap.

## 7. Icons (`public/icons/`)
- 24×24 grid, `stroke-width: 1.75` (2 at 16px), `round` caps and joins, corner radius 2, no fills, `currentColor`.
- Meanings: `tonspur` waveform → lines · `mitschnitt` player + arrow down · `word-to-pdf` folded page · `file-exchange` two-way arrows · `picker-drum` / `picker-dial` toggle.
- App icon: `app-icon-dark.svg` (default) and `app-icon-rust.svg`. Regenerate the PNGs (192/512/apple-touch 180) from it.
- New icons: each is a single path, no more than 3–4 strokes, the metaphor readable at 16px.

## 8. Copy
Language is English (the old UI was German). Short, factual, no marketing. Numbers and technical details in mono.
