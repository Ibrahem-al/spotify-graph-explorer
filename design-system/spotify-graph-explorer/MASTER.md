# Design System — Spotify Graph Explorer

> **LOGIC:** When building a specific page, first check `design-system/spotify-graph-explorer/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file. If not, strictly follow the rules below.

**Project:** Spotify Graph Explorer
**Category:** Developer Tool / Data Explorer
**Generated via:** UI UX Pro Max (refined for query-interface UX)
**Theme:** Dark-first, code-centric, Spotify-inspired accent

---

## 1. Color Palette

### Core surfaces (dark theme, primary delivery)

| Role | Hex | Tailwind | Usage |
| --- | --- | --- | --- |
| Background | `#0F172A` | `slate-950` | Page background, graph canvas backdrop |
| Surface-1 | `#1E293B` | `slate-800` | Cards, panels, cypher code block |
| Surface-2 | `#334155` | `slate-700` | Hover state, chip background, input border |
| Border | `#475569` | `slate-600` | Dividers, input focus ring |
| Text | `#F8FAFC` | `slate-50` | Primary copy |
| Text-muted | `#CBD5E1` | `slate-300` | Labels, metadata |
| Text-subtle | `#94A3B8` | `slate-400` | Placeholders, timestamps |

### Brand accent (Spotify-inspired green, signals action)

| Role | Hex | Tailwind | Usage |
| --- | --- | --- | --- |
| CTA / Primary accent | `#22C55E` | `green-500` | Submit button, active states, brand moments |
| CTA-hover | `#16A34A` | `green-600` | Hover on CTA |
| CTA-soft | `#22C55E` at 15% | `green-500/15` | Selected chip, badge background |

### Semantic states

| Role | Hex | Tailwind | Usage |
| --- | --- | --- | --- |
| Success | `#22C55E` | `green-500` | Success toast, healthy meta chips |
| Warning | `#F59E0B` | `amber-500` | Truncation badge, quota warnings |
| Danger | `#EF4444` | `red-500` | Error toast, validation-blocked hint |
| Info | `#38BDF8` | `sky-400` | Rationale box, helper tooltips |

### Graph node palette (categorical, high contrast on slate-950)

| Label | Hex | Tailwind | Icon (Lucide) |
| --- | --- | --- | --- |
| `:Track` | `#22C55E` | `green-500` | `Music2` |
| `:Artist` | `#A78BFA` | `violet-400` | `Mic2` |
| `:Album` | `#FB923C` | `orange-400` | `Disc3` |
| `:Genre` | `#F472B6` | `pink-400` | `Tag` |
| Edges | `#90A4AE` at 60% | — | — |
| Highlighted / selected | `#FBBF24` | `amber-400` | — |

Node sizes scale with popularity (`:Track` nodes) or degree (others): `[16px min, 40px max]` radius.

---

## 2. Typography

**Pairing:** Developer Mono (JetBrains Mono + IBM Plex Sans). Chosen because Cypher code is always visible; monospace for code, humanist sans for UI copy.

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

```ts
// tailwind.config.ts
fontFamily: {
  sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
}
```

| Token | Size / weight | Family | Usage |
| --- | --- | --- | --- |
| `display` | 36/40 · 700 | sans | Empty-state hero heading |
| `h1` | 28/34 · 700 | sans | Page title |
| `h2` | 20/28 · 600 | sans | Section headings, panel titles |
| `body` | 16/24 · 400 | sans | Default copy, input text |
| `body-sm` | 14/20 · 400 | sans | Labels, chips, metadata |
| `meta` | 12/16 · 500 | sans | Timestamps, counts, badges |
| `code` | 14/22 · 500 | mono | Cypher panel, code fragments |
| `code-sm` | 12/20 · 500 | mono | Inline code, inline labels |

Line-height ≥ 1.4 everywhere. Letter-spacing `-0.01em` on headings only.

---

## 3. Spacing & layout

| Token | Value | Usage |
| --- | --- | --- |
| `--space-1` | 4px | Tight icon gap |
| `--space-2` | 8px | Inline gap, minimum touch spacing |
| `--space-3` | 12px | Form control padding-y |
| `--space-4` | 16px | Default padding |
| `--space-6` | 24px | Card padding, section padding |
| `--space-8` | 32px | Panel gap |
| `--space-12` | 48px | Section margin |
| `--space-16` | 64px | Hero padding on desktop |

**Responsive breakpoints:** 375 (mobile S), 640 (sm), 768 (md), 1024 (lg), 1440 (xl).

**Containers:** `max-w-5xl` for readable content, `max-w-7xl` for full layout. No mixing.

**Floating elements:** navbar and toasts use `top-4 left-4 right-4` spacing, never `top-0`.

---

## 4. Shadows & depth

| Token | Value | Usage |
| --- | --- | --- |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift on cards |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Cypher panel, floating input |
| `shadow-lg` | `0 10px 30px rgba(0,0,0,0.5)` | Modals, dropdowns |
| `glow-accent` | `0 0 20px rgba(34, 197, 94, 0.25)` | CTA button hover, selected node pulse |

Dark theme requires stronger opacity than light shadows would have.

---

## 5. Motion

- Default transition: `150ms ease-out` for color, `200ms ease` for transforms.
- Page-level state changes: `200–300ms`.
- Node hover (NVL): scale 1.06, duration 150ms.
- `prefers-reduced-motion: reduce` disables all non-essential motion.

---

## 6. Component specs

### QueryInput (sticky at top)

- Height: 56 px desktop, 48 px mobile. Min-touch height ≥ 44 px.
- Background: `surface-1` at 80% opacity with `backdrop-blur-md`.
- Border: 1 px `border` color; focus ring: 2 px `green-500` + `glow-accent`.
- Rounded: `rounded-2xl` (16 px).
- Placeholder: `text-subtle`; value: `text-body`; no autocapitalize, no autocorrect.
- Submit button: 40 × 40 square, `bg-green-500`, `Lucide:ArrowUp` icon, disabled while generating (shows `Loader2` spinner).
- `touch-action: manipulation` to remove 300 ms tap delay.

### SuggestionChips (empty state)

- Horizontal scroll on mobile, wrapping on desktop.
- Chip: `py-2 px-4 rounded-full bg-surface-2 hover:bg-slate-600 text-body-sm`. Min-touch 44 px height.
- Gap: `space-2` (8 px minimum).
- 6 chips — one per acceptance example (see PLAN.md §7).

### GraphCanvas (primary result pane)

- Library: `@neo4j-nvl/react`.
- Background: `slate-950` with a radial gradient vignette from center `rgba(34,197,94,0.04)` to transparent.
- Node style: color from palette §1; 2 px outline same color at 40% opacity; selected → `amber-400` outline 3 px + `glow-accent`.
- Edge style: `#90A4AE` 1.5 px, opacity 60%; hovered 100%.
- Physics: force-directed, default spring; stabilize after 60 iterations, then freeze.
- Gestures: pinch-zoom, one-finger pan, tap-select, long-press opens property sheet, double-tap fits to screen.
- Loading: skeleton grid overlay (4 × 3 gray blocks with `animate-pulse`).
- Empty state: centered `Music2` icon at 64 px, `text-muted` copy "Ask a question above to see the graph".

### CypherPanel

- Desktop (≥ 1024 px): right sidebar, width `max-w-md`, full height, scrollable.
- Mobile: bottom-sheet drawer, peek height 64 px (shows title + ms chip), drag-up expands to 85 vh.
- Code block: `bg-surface-1 rounded-xl p-4 font-mono text-code` with syntax highlighting (Cypher grammar via `shiki` or `prismjs`).
- Copy button: top-right, `Lucide:Copy`, switches to `Check` for 1.5 s on click.
- Rationale box above code: `bg-sky-400/10 border-sky-400/30 rounded-lg p-3 text-body-sm`.
- Meta chip row below code: `ms · nodes · edges · truncated?` (see §9).

### ByoKeyModal

- Overlay: `bg-black/60 backdrop-blur-sm`.
- Panel: `bg-surface-1 rounded-2xl max-w-md p-6 shadow-lg`.
- 3-step content: "1. Open Google AI Studio → 2. Create an API key → 3. Paste below" with external-link icons on steps 1 & 2.
- Key input: `type=password`, label "Your Gemini API key", hint text "Stored only in your browser. Never sent to us."
- Buttons: primary "Save & retry", secondary "Cancel", tertiary "Use Ollama instead" (only visible when `!isMobile`).
- Focus trapped; `Escape` closes; underlying page inert.

### Toast / error

- Position: `bottom-6` on mobile, `top-6 right-6` on desktop.
- Background: `bg-red-500/10 border border-red-500/50 text-red-200` for error; analogous for success/info.
- Icon: `Lucide:CircleAlert` / `CircleCheck` / `Info`.
- Auto-dismiss: 5 s; `Escape` dismisses; `role="status"` for screen readers.

### Meta chip row

- Chips: `bg-surface-2 rounded-full py-1 px-3 text-meta`.
- `ms` chip: `success` color if < 500, `warning` if < 2000, `danger` otherwise.
- `truncated` chip: `warning` color when true; omitted when false.

---

## 7. Page pattern

**Pattern:** Minimal Single Column (Data Explorer variant).

1. Floating sticky header (8 px below viewport top) with brand mark + BYO-key chip.
2. Query input row: input + submit button.
3. Suggestion chips row (empty state only).
4. Result area: graph (left 2/3 desktop · full-width mobile) + cypher panel (right 1/3 desktop · bottom sheet mobile).
5. Minimal footer link: `View source · View prompt.md`.

No marketing sections. No pricing. No scroll-snap. The graph **is** the experience.

---

## 8. Accessibility rules (non-negotiable)

- Focus ring visible on every interactive element (`ring-2 ring-green-500 ring-offset-2 ring-offset-slate-950`).
- All icons from a single SVG set (Lucide). **No emoji as UI icons.**
- Touch targets ≥ 44 × 44 px, spacing ≥ 8 px.
- Text contrast: body `#F8FAFC` on `#0F172A` = 18.4:1 ✅. Muted `#CBD5E1` on `#0F172A` = 12.6:1 ✅.
- `prefers-reduced-motion` disables graph physics animation and node hover scale.
- Graph has an "adjacency list" alternative view (collapsible `<details>` below the canvas) for screen-reader users.
- All images and icons have `alt` / `aria-label`.
- Keyboard: `Tab` through input → submit → chips → cypher-copy → graph-focus. `/` focuses the input from anywhere.

---

## 9. Metadata & feedback language

- Loading: "Thinking…" under input, skeleton in graph, spinning cypher shimmer.
- Success meta chips: `"412 ms"`, `"12 nodes"`, `"17 edges"`, `"truncated"` if applicable.
- Empty-result state: "No results for this query. Try a different question."
- Error codes map to human text (see PLAN.md §5.3).

---

## 10. Anti-patterns (forbidden)

- ❌ Emoji icons anywhere in UI.
- ❌ `scale` transforms that shift surrounding layout on hover.
- ❌ Invisible borders or transparent glass with < 80% opacity on dark mode content surfaces.
- ❌ Instant state changes (must have a 150–300 ms transition).
- ❌ Horizontal scroll on mobile (except inside dedicated scroll containers like chips).
- ❌ Fixed navbars covering content.
- ❌ Fonts other than the two declared.
- ❌ Colors outside the palette without declaring them here first.
