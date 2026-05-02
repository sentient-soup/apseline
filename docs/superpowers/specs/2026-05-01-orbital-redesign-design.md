# Apseline — Orbital Redesign Design

**Date:** 2026-05-01
**Status:** Draft, awaiting user review
**Scope:** Frontend redesign of the Apseline dashboard around a solar-system metaphor. Backend, config schema, and discovery logic are out of scope; this spec only changes how the existing data is presented.

---

## 1. Vision

The dashboard becomes a single coherent solar system. The user's infrastructure is rendered as celestial bodies orbiting an off-center star, and **navigation is camera movement** — there are no page swaps. Zoom level is the navigation:

- **System view** (default): the whole solar system. All nodes visible at once.
- **Planet view**: zoomed in on one node. Satellites (services) become visible and clickable.
- **Service detail**: a blueprint-styled modal anchored to the selected satellite, planet view dimmed but visible behind.

The aesthetic is a fusion of two registers:

- **Constellation** carries the data — services are stars/satellites, nodes are wireframe planets.
- **Blueprint** carries the chrome — corner brackets, monospaced telemetry, callout lines, faint grid, near-black background.

Color is restrained. All hues sit at roughly the same lightness so identity is carried by hue alone, never by brightness. Color signals state (alerts pulse warm-red); the rest of the chrome is white-on-near-black at varying opacities.

### What this replaces

Today the app has a single "services grid" page with a Perihelion/Aphelion toggle in the header. After this redesign:

- The grid view goes away. Services live on their planet.
- The Perihelion/Aphelion toggle is replaced by camera navigation (clicking a planet).
- The existing `OrbitalBackground` canvas component is kept for ambient starfield, retuned to the new palette.

---

## 2. Spatial model

### Star (origin)

- Empty placeholder at the **left focus** of every orbital ellipse, screen-position around 37% from the left edge.
- Renders as two faint white circles (`r=6` outline, `r=14` halo). No fill, no glow, no label.
- Reserved for future use; the user explicitly asked to leave it empty for now.

### Orbits

All orbits are real ellipses with the **star at the left focus**, not the center. The star x-coordinate becomes a layout constant; ellipse centers are computed as `(star_x + a*e, star_y)` where `a` is the semi-major axis and `e` the eccentricity.

| Orbit  | Semi-major (a) | Eccentricity (e) | Purpose                          |
|--------|----------------|------------------|----------------------------------|
| Inner  | 140            | 0.45             | Perihelion (homelab) sits at perihelion (left vertex) |
| Middle | 240            | 0.50             | Aphelion (cloud) sits at aphelion (right vertex) |
| Outer  | 360            | 0.40             | Cloud-provider planets (Cloudflare, GCE, future) |

Eccentricity values are tuned so that the names "Perihelion" and "Aphelion" become **astronomically literal** — the homelab really is the closest body, the cloud really is the farthest.

Orbits render as static SVG `<ellipse>` strokes at very low opacity (`rgba(255,255,255,0.05–0.08)`).

### Planets

Two **primary** planets and an open-ended set of **outer** planets.

**Primary planets (Perihelion, Aphelion)** are wireframe spheres composed of:
- An outline circle.
- A faint halo ring (slightly larger circle at low opacity).
- Two skewed ellipses overlaid via `transform="skewX(±20) rotate(±15)"` to suggest sphere geometry without requiring 3D math.
- A small filled core dot.
- A few hint-satellites visible even at system zoom (so the planet looks "populated" before zoom-in).

**Outer planets (Cloudflare, GCE, etc.)** are smaller versions of the same wireframe — single outline, one skewed ellipse, single core dot. They render at fixed positions on the outer orbit.

Planet positions on each orbit are configurable (per-node config); the layout solver places primary planets at their respective extremes by default, and outer planets at angles assigned in config.

### Satellites (services)

Visible only in **planet view**. Rendered as filled circles at varying sizes (1.5–4 px scaled with zoom level) on multiple **near-circular orbits** around the planet. Three orbital tiers per planet (inner / middle / outer) exist so that a planet with many services doesn't visually overlap.

Satellite assignment to a tier is heuristic and stable across re-renders:
1. Group services by category if available, else by alphabetical hash.
2. Inner tier: high-traffic / high-priority services (manually flagged in config).
3. Middle/outer: everything else, distributed evenly by angle.

Satellites carry a label rendered as small monospaced text adjacent to each circle. Labels are visible at planet-zoom and dim/hide at system-zoom.

---

## 3. Navigation & state

The app has a single canonical state:

```ts
type View =
  | { kind: 'system' }
  | { kind: 'planet'; nodeId: string }
  | { kind: 'service'; nodeId: string; serviceId: string };  // modal layered on planet view
```

- `system` is the default landing.
- `planet` is reached by clicking a planet from any state.
- `service` is `planet` plus a modal; navigating to a different planet first closes the modal then runs the planet→planet transition.

### Utility dock (non-service nav)

A muted bottom-right dock carries non-spatial nav: `settings`, `logs`, `discovery`, `alerts · N`. Items are tiny lowercase monospaced text + 2px status pip, sized to match the bottom-left telemetry strip (`NET ↑ … / DISK …`). Only `alerts` carries color (warm-red) when N > 0; the rest are white at 50% opacity, brightening on hover.

These items open as **overlay panels** that float over the solar system but do not change camera state — closing returns the user to whatever view they were in.

---

## 4. Transitions

Three transition types. All transitions are **camera moves** in a 2D coordinate space — no element teleports, nothing pops in or out.

### 4.1 System → Planet (zoom-in dolly)

- **Duration:** 600ms, ease-in-out cubic.
- **t=0–200ms:** orbits expand slightly, neighbor planets fade to ~40% opacity.
- **t=200–400ms:** target planet scales up; camera dollies toward it.
- **t=400–600ms:** wireframe latitudes resolve, satellites fade in (see §4.4), header chrome cross-fades to the planet's name + telemetry.

### 4.2 Planet → Planet (the "swoop", 800ms)

The headliner. Cinematic but not floaty.

- **Duration:** 800ms, ease-in-out cubic.
- **Camera path:** quadratic Bézier through three waypoints — current planet → apex over the star → destination planet.
  - **Apex** sits directly above the star's x-coordinate (off-center), at a y roughly equal to system-view altitude. Because the star is off-center, the swoop is **asymmetric** — short pull-back from Perihelion side, long descent to Aphelion side, and vice versa. This is intentional.
- **t=0:** open modal closes (if any).
- **t=0–200ms:** pull-back. Current planet shrinks; orbit rings reappear.
- **t=200–400ms:** ascent to apex; full system briefly visible.
- **t=400ms (apex):** header chrome cross-fades. The user sees the label change while looking at the whole system, so the rename feels like the camera shifting context, not the page.
- **t=400–600ms:** descent. Destination planet scales up.
- **t=600–800ms:** wireframe latitudes resolve, satellites fade in.

### 4.3 Planet → System (reverse dolly)

- **Duration:** 500ms, ease-out cubic.
- Camera pulls back, current planet shrinks into its orbital position, neighbors fade in. Inverse of the dolly-in but slightly faster — pulling back is naturally lower-effort than zooming in.

### 4.4 Satellite arrival

Independent of which transition is running, satellites **fade in from black** during the final phase:

- t = transition end − 200ms : satellite opacity = 0
- t = transition end : satellite opacity = 1, color fully resolved

Satellites do **not** arrive from off-screen. They materialize in place, at their orbital position, fading from transparent black to their color.

### 4.5 Skip & redirect

- **Esc** or clicking the same destination again → snap to end-state (no further animation).
- **Clicking a different destination mid-flight** → re-route from current camera position. The current Bézier is replaced with a new one starting at the camera's current `(x, y, scale)` waypoint; no snap-back.
- **`prefers-reduced-motion`** → all camera moves replaced by a 200ms cross-fade. The spatial relationship is preserved (planets stay in their positions), but no zoom/pan happens.

---

## 5. Service detail modal

Triggered by clicking a satellite in planet view.

- **Anchor:** top-right of the viewport, fixed position (not following the satellite). A faint blueprint **callout line** connects the modal frame to the selected satellite.
- **Selected satellite** gets a highlight ring (`stroke-dasharray="2 3"`) and a slightly larger fill.
- **Backdrop:** the planet view dims to ~35% opacity. It is **not** blacked out — the modal lives over the planet, not in front of it.
- **Modal chrome** matches the page chrome: corner brackets, monospaced labels, blueprint divider lines.
- **Modal content** (per the existing service data model):
  - Header: breadcrumb (`PERIHELION ▸ SVC ▸ #N`), service name, type, host
  - Status row, uptime, host:port, version
  - 30-min CPU sparkline (SVG `<polyline>`)
  - Action buttons: `▸ OPEN` (primary), `LOGS`, close
- **Dismissal:** Esc, click outside the modal, click `✕`, or any nav action that changes view.

---

## 6. Palette & themes

### 6.1 Palette tuning rules

All accent hues sit at HSL **L = 64–70%, S = 35–55%**. Identity comes from hue alone. Background is near-black (lightness ≈ 7–10%).

### 6.2 Default theme: `nebula-warm` (#13121A)

| Token              | Hex     | Notes                                         |
|--------------------|---------|-----------------------------------------------|
| `bg`               | #13121A | Warm-neutral near-black                       |
| `perihelion`       | #DA79B0 | Muted rose-pink — homelab identity            |
| `aphelion`         | #A091D6 | Muted lavender — cloud identity               |
| `cloudflare`       | #7BA5CC | Muted slate-blue                              |
| `gce`              | #7DC0A4 | Muted sage                                    |
| `warn` / camera    | #D4B97A | Muted amber — used for camera waypoints, hover |
| `alerts`           | #D48989 | Muted warm rose — only state-color in chrome  |
| `text-primary`     | rgba(255,255,255,0.6) | All static text                  |
| `text-muted`       | rgba(255,255,255,0.4) | Telemetry, labels                |
| `chrome`           | rgba(255,255,255,0.22) | Corner brackets, dividers      |
| `orbit-faint`      | rgba(255,255,255,0.05–0.08) | Orbital rings              |

### 6.3 Alt themes

User-selectable from the `settings` panel. Each theme retunes the accent hues to harmonize with its background's undertone, while keeping all hues at the same lightness band.

| Theme           | Bg       | Perihelion | Aphelion | Cloudflare | GCE     | Warn    | Alerts  |
|-----------------|----------|------------|----------|------------|---------|---------|---------|
| `nebula-warm` (default) | #13121A | #DA79B0 | #A091D6 | #7BA5CC | #7DC0A4 | #D4B97A | #D48989 |
| `nightfall`     | #0F0F1E  | #DA79B0    | #8B95E0  | #6FA8DC    | #7DBDC0 | #C7B27A | #C88A95 |
| `nebula-ink`    | #100E1A  | #DC7AB6    | #B093E0  | #82A8D6    | #88C4A8 | #D6BD80 | #D88A92 |
| `dusty-plum`    | #18121C  | #E18AB6    | #B098D8  | #8AABCC    | #93C5A8 | #DCBE82 | #DC8E8E |
| `blueprint`     | #0E0F14  | #C97DA8    | #968FCE  | #7AA3CC    | #7CBDA0 | #CBB077 | #CC8585 |
| `void`          | #0A0A14  | #E07AB2    | #A98FE2  | #7AA8D8    | #7AC4A4 | #DCBC78 | #DC8585 |

Themes are applied via CSS custom properties on `:root`. Changing theme is instantaneous (no transition); persists in `localStorage`.

---

## 7. Architecture

### 7.1 Rendering split

Performance budget: **60fps on a Raspberry Pi 4 / mid-tier laptop** for all transitions.

- **SVG + CSS transforms** for everything structural: planets, orbits, satellites, modal, chrome, transitions. SVG elements use `transform: translate3d() scale()` driven by Framer Motion to stay GPU-accelerated.
- **Canvas (existing `OrbitalBackground.tsx`)** for ambient starfield only. Retuned to the new palette; particle count unchanged.
- **WebGL** is **not used**. Reserved as a v2 escape hatch if depth/parallax becomes desired later — the architecture is structured so swapping the renderer is local.

### 7.2 Component structure

```
client/src/
  App.tsx                      # routes view state to <SolarSystem>
  stores/
    viewStore.ts               # NEW: { kind, nodeId?, serviceId? }, actions: navigate(view)
    servicesStore.ts           # existing — unchanged
    themeStore.ts              # NEW: themeId, persisted to localStorage
  components/
    SolarSystem/
      index.tsx                # outer SVG, orchestrates camera, renders children
      Camera.tsx               # NEW: motion.g wrapping the scene; computes transform from view + transition
      Star.tsx                 # NEW: the empty placeholder
      Orbit.tsx                # NEW: a single ellipse stroke
      Planet/
        index.tsx              # primary planet wireframe
        OuterPlanet.tsx        # smaller variant
        Satellites.tsx         # satellite cloud for a planet
      Chrome/
        Brackets.tsx           # corner brackets
        Header.tsx             # APSELINE ▸ … label, top-right clock
        Telemetry.tsx          # bottom-left NET/DISK strip
        UtilityDock.tsx        # bottom-right nav
      ServiceModal/
        index.tsx              # modal frame + content
        CalloutLine.tsx        # blueprint line from satellite to modal
    OrbitalBackground.tsx      # existing — retune palette only
    Header.tsx                 # existing — DELETE; replaced by Chrome/Header
    ServiceCard.tsx            # existing — DELETE; replaced by Satellites + Modal
    ServiceGrid.tsx            # existing — DELETE; replaced by SolarSystem
  lib/
    geometry.ts                # NEW: ellipse focus math, satellite tier placement
    transitions.ts             # NEW: Bézier camera paths, skip/redirect logic
    palette.ts                 # NEW: theme tokens as CSS custom properties
```

### 7.3 Transition implementation

Camera transform `(translateX, translateY, scale)` is animated via Framer Motion `useMotionValue` + `useTransform`. The Planet→Planet swoop uses a custom **path interpolator**:

```ts
// Quadratic Bézier through (start, apex, end). t ∈ [0,1].
function cameraAt(t: number, start: Pt, apex: Pt, end: Pt): Pt {
  const u = 1 - t;
  return {
    x: u*u*start.x + 2*u*t*apex.x + t*t*end.x,
    y: u*u*start.y + 2*u*t*apex.y + t*t*end.y,
  };
}
```

Apex is pinned to `{ x: starX, y: starY - SYSTEM_ALTITUDE }`. Scale is independently interpolated from `planetScale → systemScale → planetScale` over the same `t`.

Mid-flight redirect rebuilds a fresh Bézier whose `start` is the camera's current `(x, y)` at interruption.

### 7.4 Reduced-motion path

`useReducedMotion()` short-circuits the camera animator: view changes apply to the scene state immediately, and only the chrome cross-fades (200ms opacity).

---

## 8. Out of scope (explicit non-goals)

- **Backend changes.** Service discovery, config schema, websocket events — all unchanged.
- **3D depth / parallax.** WebGL deferred to v2.
- **Asteroid belt for utility nav.** Considered and rejected — utility lives in the bottom-right dock.
- **Multiple satellite zoom levels.** Clicking a satellite opens a modal; there is no further zoom into the satellite itself.
- **Real orbital mechanics.** Satellite motion is decorative (slow rotation around planet); planets do not physically orbit the star — they are placed.
- **What lives at the star.** Empty placeholder for now; user is "stewing on it."

---

## 9. Open questions deferred to implementation

- **Satellite motion** — slow rotation vs. fully static. Try slow rotation first; gate behind reduced-motion. Decision deferred to first prototype.
- **Adaptive scaling** — what does the system look like at < 800px viewport width? Likely needs a smaller `a/e` set or single-column reduced layout. Will be addressed during implementation, not now.
- **Adding a node** — the `+ ADD` placeholder visible in early mockups is not in this scope. Adding a new outer planet today requires a config edit; UI for adding nodes is a future feature.

---

## 10. Acceptance criteria

The redesign is "done" when:

1. Default landing renders the system view with star, three orbits, two primary planets at their geometric extremes, and the existing cloud-provider planets on the outer orbit.
2. Clicking a primary planet performs the §4.1 zoom-in dolly to a planet view in ≤ 600ms.
3. Clicking a different primary planet from a planet view performs the §4.2 swoop in ≤ 800ms with chrome cross-fade at the apex.
4. Clicking a satellite opens the §5 modal anchored top-right with callout line.
5. The bottom-left telemetry and bottom-right utility dock render and are sized within ±2px of the bottom-left telemetry baseline.
6. Theme picker in `settings` switches between the six themes in §6.3 with no flash.
7. `prefers-reduced-motion: reduce` disables all camera moves; navigation still works.
8. All transitions sustain 60fps on a 2020-era laptop in Chrome and Firefox.
