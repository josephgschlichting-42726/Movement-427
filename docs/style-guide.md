# Style Guide — Industrial Retro-Futurism

Design direction: A precision-built digital experience inspired by industrial machinery, vintage signage, and retro-futurist graphic design.

Core idea: **Industrial character on the surface. Modern precision underneath.**

Visual reference: [`reference/mural-closeup.jpg`](reference/mural-closeup.jpg), [`reference/mural-room.jpg`](reference/mural-room.jpg) — oversized overlapping "2"/"5" numerals in signal orange and brushed concrete, vertical stacked type, teal window panels, warm amber floor light.

> Part A is the original guide. Part B is the app adaptation: what changes or gets added so the guide works for a workout tracker used mid-set, outdoors, offline, on iPhone. **Where they conflict, Part B wins.**

---

## Part A — Original guide

### 1. Creative direction

* **Industrial:** Dark metals, graphite, worn surfaces, mechanical references.
* **Bold:** Oversized typography, strong geometry, confident composition.
* **High contrast:** Vivid orange against deep black.
* **Analog-inspired:** Physical materials, instrumentation, and tactile controls.
* **Modern:** Clean layouts, precise information hierarchy, and intuitive interactions.

The goal is not to recreate an old machine or a vintage interface. It is to combine the personality of industrial design with the usability of a contemporary digital product.

Personality: Confident, unconventional, tactile, purposeful, and slightly rebellious.

### 2. Color palette

| Color | Hex | Purpose |
|---|---|---|
| Signal Orange | `#F05A24` | Primary accent and actions |
| Hot Orange | `#FF6B35` | Secondary emphasis |
| Machine Black | `#101110` | Primary background |
| Graphite | `#222321` | Panels and surfaces |
| Dark Steel | `#383936` | Borders and dividers |
| Brushed Metal | `#77766D` | Secondary visual elements |
| Warm Silver | `#B9B6AA` | Secondary text |
| Bone White | `#F0EEE6` | Primary text |
| Industrial Teal | `#79A6A4` | Occasional contrasting accent |

Usage rules:

* Black and graphite establish the environment.
* Bone White provides readable content.
* Orange directs attention and communicates activity.
* Metallic neutrals create depth.
* Teal is reserved for occasional secondary emphasis.

Orange should be distinctive, not ubiquitous. Avoid making every button, icon, and indicator orange.

### 3. Typography

| Typeface | Role | Character |
|---|---|---|
| Oswald | Headlines and display | Tall, condensed, industrial |
| Inter | Interface and body text | Clean, modern, readable |
| IBM Plex Mono | Metrics and labels | Technical, precise, instrument-like |

* Use oversized numerals and condensed headlines for visual impact.
* Use conventional sans-serif typography for readability.
* Use monospaced typography for measurements, metrics, and technical labels.
* Use uppercase selectively for short labels.
* Maintain strong contrast between headlines and supporting information.

Large, overlapping, or cropped typography can be used as a signature visual treatment for feature screens and important moments.

### 4. Composition and visual language

**Composition:** one dominant visual element per screen; asymmetry and oversized type used selectively; negative space for emphasis; strong alignment and clear hierarchy; dividers and contrast rather than excessive containers.

**Materials and textures:** subtle grain, distressed metal, brushed surfaces; restrained metallic gradients; dark solid surfaces for functional elements; texture primarily in backgrounds and decorative treatments.

**Shape language:** geometric and slightly angular; minimal corner rounding; strong lines and clear boundaries; avoid floating cards, soft shadows, and bubbly shapes.

### 5. Interface and interaction principles

| Element | Design direction |
|---|---|
| Buttons | Strong contrast, solid fills, minimal rounding |
| Cards | Graphite surfaces, subtle borders, restrained padding |
| Navigation | Minimal icons, clear active states, orange indicators |
| Inputs | Dark surfaces, visible borders, orange focus states |
| Metrics | Large numerals, monospaced supporting labels |
| Progress | Orange indicators, simple geometry, clear values |
| Icons | Consistent, minimal, geometric line icons |

Fast, purposeful transitions. Subtle compression on press. Clear feedback for success, errors, and active states. No decorative animation.

Accessibility is foundational: sufficient contrast, visible focus states, readable typography, clear status indicators.

### 6. Design principles

**Do:** make orange meaningful · use typography as a major visual element · combine industrial textures with clean interface surfaces · create strong hierarchy · use asymmetry for personality · prioritize clarity.

**Don't:** turn every screen into a dark, distressed graphic · overuse orange or metallic effects · look like a gaming dashboard · sacrifice readability · add purposeless decoration · animate because it looks futuristic.

**Creative north star:** A precision-built digital instrument wrapped in the visual language of industrial machinery, vintage signage, and retro-futurist typography.

**Design test:** If the interface lost its logo, would its typography, color, composition, and visual character still make it recognizable?

---

## Part B — App adaptation

### B1. Fit assessment

The guide fits this app unusually well. A workout tracker is mostly numbers (weight, reps, time, ratings), and the guide's signature move is oversized numerals with mono labels. The "instrument" metaphor maps directly onto logging and timing.

Gaps found and addressed below: some palette pairs fail contrast, there are no status or chart colors, sunlight use, touch ergonomics, live-counter digit jitter, iOS input zoom, and offline font loading.

### B2. Contrast audit (WCAG 2.x)

| Pair | Ratio | Verdict |
|---|---|---|
| Bone White on Machine Black | 16.3 | ✅ body text |
| Bone White on Graphite | 13.6 | ✅ body text |
| Warm Silver on Machine Black / Graphite | 9.3 / 7.8 | ✅ secondary text |
| Brushed Metal on Machine Black / Graphite | 4.1 / 3.5 | ⚠️ large text, icons, borders only — **never body text** |
| Signal Orange on Machine Black / Graphite | 5.6 / 4.7 | ✅ accent text and indicators |
| Industrial Teal on Machine Black / Graphite | 7.0 / 5.9 | ✅ |
| **Bone White on Signal Orange** | **2.9** | ❌ **fails** |
| Machine Black on Signal Orange | 5.6 | ✅ use this for primary buttons |
| Machine Black on Hot Orange | 6.7 | ✅ |
| Dark Steel on Machine Black / Graphite | 1.6 / 1.4 | ❌ decorative dividers only |

Rules that follow:

* **Primary buttons use Machine Black text on Signal Orange**, not white.
* **Input borders use Brushed Metal** (3:1 needed for UI boundaries); Dark Steel is only for decorative hairline dividers.
* Brushed Metal is never used for text under 18pt.

### B3. Added tokens

| Token | Value | Use |
|---|---|---|
| `--status-success` | Industrial Teal `#79A6A4` | Saved, completed, rest phase |
| `--status-error` | `#E8484A` + icon + text | Errors only. Too close to orange to stand alone, so **never color-only**: always an icon, a label, and a hazard-stripe edge |
| `--status-warn` | `#E0B341` (the amber of the floor light) | Unsynced or offline indicators |
| `--focus-ring` | Hot Orange, 2px solid, 2px offset | All focusable elements |

**Chart palette** (data series need more than one accent; orange stays the hero):

| Series | Color |
|---|---|
| Primary metric (volume, minutes, joy) | Signal Orange |
| Sleep | Industrial Teal |
| Mood | Bone White |
| Motivation | Amber `#E0B341` |
| Comparison or previous period | Brushed Metal, dashed |

Series are also told apart by line style or markers and direct labels, not color alone. Validate with the dataviz checker before shipping charts.

### B4. Typography rules for a live instrument

* **Live counters (timer, rest countdown) use IBM Plex Mono or tabular figures** (`font-variant-numeric: tabular-nums`) so digits don't jitter as they change. Oswald is for static display numerals (the last set's weight, the joy score, headings).
* **All text inputs are at least 16px.** Below that, iOS Safari zooms the page on focus.
* Self-host all three fonts as subsetted WOFF2 and precache them in the service worker so the app looks right offline. Use `font-display: swap` with metric-matched fallbacks.
* Support Dynamic Type sizes using `rem` and `clamp()`. Display numerals scale down before they truncate.

### B5. Ergonomics (gym, farm, sweaty thumbs)

* Minimum touch target **48×48pt**. Primary set-logging actions are **56pt+** and sit in the bottom third of the screen (thumb zone).
* Weight and reps use **steppers plus a numeric keypad** (`inputmode="decimal"`/`"numeric"`). Stepper increments: 5 lb weight, 1 rep; long-press for repeat.
* The 1–5 ratings are **five large segmented "selector switch" keys** showing the numerals in Oswald. One tap, no slider.
* **Sunlight:** the dark theme is the default. When contrast matters most (logging, timer), key numerals are Bone White at 600+ weight on solid Machine Black, never over texture. A high-visibility daylight variant is a later option, not v1.
* Haptics aren't available to iOS web apps, so press feedback is visual (2px compression) and the timer uses audio cues.

### B6. Texture and motion budget

* Texture (grain, brushed metal) appears **only** on hero and summary screens and the app background. Logging and timer screens use flat solid surfaces.
* Grain is a single tiny tiled noise image or CSS gradient, with no runtime filters. This protects battery and scroll smoothness.
* Transitions are ≤150ms, ease-out. All motion respects `prefers-reduced-motion`.

### B7. Signature moments (where the mural shows up)

1. **Joy-to-move summary:** when a session ends, the start and end joy scores appear as two giant overlapping, cropped numerals, like the mural's "2" and "5". Start is in Brushed Metal or concrete texture, end in Signal Orange. A rise reads at a glance.
2. **Interval timer:** one full-screen numeral. **Work = Signal Orange field, Rest = Industrial Teal field**, plus a phase label in uppercase Plex Mono ("WORK 2/4"). Orange vs. teal stays distinguishable for common color-vision deficiencies, and the label backs it up.
3. **Daily check-in:** three stacked rows (SLEEP / MOOD / DRIVE), with vertical stacked labels echoing the mural's vertical "time theater" type.
4. **"Last time" ghost values:** the previous session's numbers sit inside the inputs in Brushed Metal mono. One tap accepts them.

### B7a. Wordmark — mōv

* Spelled **mōv** (lowercase; the macron marks the long "o", pronounced "move").
* Oswald 700, treated like the Today date numerals: **"m" and "ō" in brushed concrete**, **"v" in Signal Orange**.
* **Floor and crop:** the letters stand on a floor line (the crop edge) and step down left→right. The "m" sits on the floor, the "ō" dips just below it, and the orange "v" overlaps the "ō" and sinks furthest, so it's cropped like the Today "1". The step-down carries the sense of forward motion.
* **Spacing:** m–ō tight (nearly touching); the macron is a drawn concrete block sitting tight above the "o".
* Component: `src/components/Wordmark.tsx` (`floor` prop draws the hairline). App icon: concrete "ō" and orange "v", both cropped by the bottom edge, with the "v" lower.
* **Splash:** letters rise up through the floor in sequence (m → ō → v, ~90ms stagger, sliding slightly forward). The "v" overshoots a touch before settling, the macron wipes in, the tagline fades in, then the splash fades out at ~1.35s. Tap to skip; Reduce Motion shows it static. iOS launch images are plain Machine Black.

### B8. Components (v1)

Primary button · secondary (outline) button · stepper · numeric field · 1–5 selector · set row (with kind chip: WARM-UP / WORKING / DROP / NEG) · session card · bottom nav (4 items, orange underline indicator) · sync status pip · timer display · empty states with a single oversized numeral or word.

Corner radius: **2px** for everything. 0 is allowed for full-bleed panels.
