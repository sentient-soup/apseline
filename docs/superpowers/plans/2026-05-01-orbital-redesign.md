# Apseline Orbital Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing services-grid dashboard with a solar-system metaphor (off-center star, eccentric orbits, wireframe planets, satellite services, blueprint chrome) wired up with camera-based navigation and three orbital transitions.

**Architecture:** SVG + CSS transforms primary, Canvas for ambient starfield (existing component, retuned), Framer Motion for camera animations, Zustand for state (one new store for view, one for theme). No WebGL. All accent hues at uniform lightness; six selectable themes via CSS custom properties.

**Tech Stack:** React 19, TypeScript 5.3, Vite 5, Tailwind 3, Framer Motion 11, Zustand 5.

**Testing policy:** **No unit tests in this project.** Verification is manual: run `pnpm dev`, exercise the feature in a browser. Each task ends with a manual smoke step where applicable, then a commit.

**Source spec:** [`docs/superpowers/specs/2026-05-01-orbital-redesign-design.md`](../specs/2026-05-01-orbital-redesign-design.md)

**Repo note:** Working on branch `feat/orbital-redesign`. Initial snapshot already committed on `main`.

---

## Pre-task: scrub legacy vitest scaffolding

Earlier exploration left some Vitest files in the client. They must be removed before implementation begins.

- [ ] **Step 1: Delete vitest files**

```bash
rm client/vitest.config.ts client/vitest.setup.ts
```

- [ ] **Step 2: Remove vitest deps from `client/package.json`**

Remove these from `devDependencies` if present: `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. Remove `test` and `test:watch` from `scripts` if present.

```bash
pnpm --filter @apseline/client remove vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event 2>/dev/null || true
```

- [ ] **Step 3: Remove vitest types from `client/tsconfig.json`**

If `compilerOptions.types` references `"vitest/globals"` or `"@testing-library/jest-dom"`, remove those entries.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove vitest scaffolding (no unit tests in this project)"
```

---

## File map (created / modified / deleted)

```
client/
  package.json                           (already modified by pre-task)
  tsconfig.json                          (already modified by pre-task)
  tailwind.config.js                     MODIFY  add CSS-var-driven theme palette
  src/
    main.tsx                             MODIFY  apply initial theme on boot
    App.tsx                              MODIFY  render <SolarSystem> instead of grid
    index.css                            MODIFY  define :root CSS variables (default theme)

    lib/
      geometry.ts                        CREATE  ellipse focus math, satellite placement
      transitions.ts                     CREATE  Bézier camera paths, scale interp, redirect
      palette.ts                         CREATE  theme token tables + applyTheme()

    stores/
      viewStore.ts                       CREATE  { kind, nodeId?, serviceId? } + navigate()
      themeStore.ts                      CREATE  themeId + persistence
      servicesStore.ts                   UNCHANGED

    components/
      OrbitalBackground.tsx              MODIFY  retune particle color tokens
      Header.tsx                         DELETE
      ServiceCard.tsx                    DELETE
      ServiceGrid.tsx                    DELETE
      SolarSystem/
        index.tsx                        CREATE  outer SVG, scene composition
        layout.ts                        CREATE  layout constants + node positions
        Camera.tsx                       CREATE  motion.g wrapper, drives camera transform
        Star.tsx                         CREATE  empty placeholder at left focus
        Orbit.tsx                        CREATE  one ellipse stroke
        Planet/
          index.tsx                      CREATE  primary wireframe planet
          OuterPlanet.tsx                CREATE  small variant
          Satellites.tsx                 CREATE  satellite cloud + labels
        Chrome/
          Brackets.tsx                   CREATE  4 corner brackets
          Header.tsx                     CREATE  top-left label, top-right clock
          Telemetry.tsx                  CREATE  bottom-left NET/DISK
          UtilityDock.tsx                CREATE  bottom-right utility nav
        ServiceModal/
          index.tsx                      CREATE  modal frame
          CalloutLine.tsx                CREATE  blueprint line satellite→modal
          SatelliteHighlight.tsx         CREATE  highlight ring on selected satellite
        Settings/
          ThemePicker.tsx                CREATE  swatches for 6 themes
          SettingsPanel.tsx              CREATE  overlay panel hosting ThemePicker
```

---

## Task 1: Geometry library

**Files:**
- Create: `client/src/lib/geometry.ts`

- [ ] **Step 1: Implement geometry.ts**

```ts
export interface Pt { x: number; y: number }
export type Vertex = 'perihelion' | 'aphelion';

export function ellipseCenterFromLeftFocus(focus: Pt, a: number, e: number): Pt {
  return { x: focus.x + a * e, y: focus.y };
}

export function vertexAt(focus: Pt, a: number, e: number, kind: Vertex): Pt {
  const center = ellipseCenterFromLeftFocus(focus, a, e);
  return { x: kind === 'perihelion' ? center.x - a : center.x + a, y: center.y };
}

export function satelliteSlotsForTier(count: number, radius: number, phase = 0): Pt[] {
  const slots: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const theta = phase + (i * 2 * Math.PI) / count;
    slots.push({ x: radius * Math.cos(theta), y: radius * Math.sin(theta) });
  }
  return slots;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/geometry.ts
git commit -m "feat(geometry): ellipse focus math + satellite slot helper"
```

---

## Task 2: Transitions library

**Files:**
- Create: `client/src/lib/transitions.ts`

- [ ] **Step 1: Implement transitions.ts**

```ts
import type { Pt } from './geometry';

export interface CameraPath {
  start: Pt;
  apex: Pt;
  end: Pt;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function quadBezier(t: number, start: Pt, apex: Pt, end: Pt): Pt {
  const u = 1 - t;
  return {
    x: u * u * start.x + 2 * u * t * apex.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * apex.y + t * t * end.y,
  };
}

export function redirectFromMidflight(current: Pt, apex: Pt, newEnd: Pt): CameraPath {
  return { start: current, apex, end: newEnd };
}

export const SWOOP_DURATION_MS = 800;
export const SWOOP_APEX_MS = 400;
export const ZOOM_IN_DURATION_MS = 600;
export const ZOOM_OUT_DURATION_MS = 500;
export const SATELLITE_FADE_MS = 200;
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/transitions.ts
git commit -m "feat(transitions): bezier camera path + easing"
```

---

## Task 3: Palette library + CSS vars

**Files:**
- Create: `client/src/lib/palette.ts`
- Modify: `client/tailwind.config.js`
- Modify: `client/src/index.css`

- [ ] **Step 1: Implement palette.ts**

```ts
export type ThemeId = 'nebula-warm' | 'nightfall' | 'nebula-ink' | 'dusty-plum' | 'blueprint' | 'void';

export interface Theme {
  bg: string;
  perihelion: string;
  aphelion: string;
  cloudflare: string;
  gce: string;
  warn: string;
  alerts: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  'nebula-warm': { bg: '#13121A', perihelion: '#DA79B0', aphelion: '#A091D6', cloudflare: '#7BA5CC', gce: '#7DC0A4', warn: '#D4B97A', alerts: '#D48989' },
  'nightfall':   { bg: '#0F0F1E', perihelion: '#DA79B0', aphelion: '#8B95E0', cloudflare: '#6FA8DC', gce: '#7DBDC0', warn: '#C7B27A', alerts: '#C88A95' },
  'nebula-ink':  { bg: '#100E1A', perihelion: '#DC7AB6', aphelion: '#B093E0', cloudflare: '#82A8D6', gce: '#88C4A8', warn: '#D6BD80', alerts: '#D88A92' },
  'dusty-plum':  { bg: '#18121C', perihelion: '#E18AB6', aphelion: '#B098D8', cloudflare: '#8AABCC', gce: '#93C5A8', warn: '#DCBE82', alerts: '#DC8E8E' },
  'blueprint':   { bg: '#0E0F14', perihelion: '#C97DA8', aphelion: '#968FCE', cloudflare: '#7AA3CC', gce: '#7CBDA0', warn: '#CBB077', alerts: '#CC8585' },
  'void':        { bg: '#0A0A14', perihelion: '#E07AB2', aphelion: '#A98FE2', cloudflare: '#7AA8D8', gce: '#7AC4A4', warn: '#DCBC78', alerts: '#DC8585' },
};

export function applyTheme(id: ThemeId): void {
  const t = THEMES[id];
  const root = document.documentElement;
  root.style.setProperty('--color-bg', t.bg);
  root.style.setProperty('--color-perihelion', t.perihelion);
  root.style.setProperty('--color-aphelion', t.aphelion);
  root.style.setProperty('--color-cloudflare', t.cloudflare);
  root.style.setProperty('--color-gce', t.gce);
  root.style.setProperty('--color-warn', t.warn);
  root.style.setProperty('--color-alerts', t.alerts);
}
```

- [ ] **Step 2: Wire CSS vars into Tailwind**

In `client/tailwind.config.js`, inside `theme.extend.colors`, add (alongside existing entries):

```js
themed: {
  bg:         'var(--color-bg)',
  perihelion: 'var(--color-perihelion)',
  aphelion:   'var(--color-aphelion)',
  cloudflare: 'var(--color-cloudflare)',
  gce:        'var(--color-gce)',
  warn:       'var(--color-warn)',
  alerts:     'var(--color-alerts)',
},
```

- [ ] **Step 3: Update index.css**

Add to the top of `client/src/index.css`:

```css
:root {
  --color-bg: #13121A;
  --color-perihelion: #DA79B0;
  --color-aphelion: #A091D6;
  --color-cloudflare: #7BA5CC;
  --color-gce: #7DC0A4;
  --color-warn: #D4B97A;
  --color-alerts: #D48989;
}
body { background: var(--color-bg); }
```

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/palette.ts client/tailwind.config.js client/src/index.css
git commit -m "feat(palette): theme tokens + CSS vars + applyTheme"
```

---

## Task 4: Theme store (Zustand)

**Files:**
- Create: `client/src/stores/themeStore.ts`

- [ ] **Step 1: Implement themeStore.ts**

```ts
import { create } from 'zustand';
import { applyTheme, THEMES, type ThemeId } from '../lib/palette';

const STORAGE_KEY = 'apseline.theme';

interface ThemeStore {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  initFromStorage: () => void;
}

function isValidThemeId(v: string | null): v is ThemeId {
  return !!v && v in THEMES;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  themeId: 'nebula-warm',
  setTheme: (id) => {
    applyTheme(id);
    localStorage.setItem(STORAGE_KEY, id);
    set({ themeId: id });
  },
  initFromStorage: () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const id: ThemeId = isValidThemeId(saved) ? saved : 'nebula-warm';
    applyTheme(id);
    set({ themeId: id });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add client/src/stores/themeStore.ts
git commit -m "feat(theme): zustand store with localStorage persistence"
```

---

## Task 5: View store

**Files:**
- Create: `client/src/stores/viewStore.ts`

- [ ] **Step 1: Implement viewStore.ts**

```ts
import { create } from 'zustand';

export type View =
  | { kind: 'system' }
  | { kind: 'planet'; nodeId: string }
  | { kind: 'service'; nodeId: string; serviceId: string };

interface ViewStore {
  view: View;
  // Bumped on every navigate() so transition components can detect new flights.
  transitionId: number;
  navigate: (next: View) => void;
  openService: (serviceId: string) => void;
  closeService: () => void;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  view: { kind: 'system' },
  transitionId: 0,
  navigate: (next) => set((s) => ({ view: next, transitionId: s.transitionId + 1 })),
  openService: (serviceId) => {
    const { view } = get();
    if (view.kind !== 'planet') return;
    set({ view: { kind: 'service', nodeId: view.nodeId, serviceId } });
  },
  closeService: () => {
    const { view } = get();
    if (view.kind !== 'service') return;
    set({ view: { kind: 'planet', nodeId: view.nodeId } });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add client/src/stores/viewStore.ts
git commit -m "feat(view): zustand view store with planet/service overlay"
```

---

## Task 6: Layout constants

**Files:**
- Create: `client/src/components/SolarSystem/layout.ts`

- [ ] **Step 1: Implement layout.ts**

```ts
import type { Pt } from '../../lib/geometry';
import { vertexAt, ellipseCenterFromLeftFocus } from '../../lib/geometry';

export const VIEWBOX_W = 800;
export const VIEWBOX_H = 480;
export const STAR: Pt = { x: 300, y: 240 };

export const ORBITS = {
  inner:  { a: 140, e: 0.45 },
  middle: { a: 240, e: 0.50 },
  outer:  { a: 360, e: 0.40 },
} as const;

export type OrbitKey = keyof typeof ORBITS;

export interface NodeDescriptor {
  id: string;
  label: string;
  kind: 'primary' | 'outer';
  colorVar: string;
  position: Pt;
}

const RY_RATIO = 0.347; // ry/rx for visible "tilted plane" — keeps points on the visible ring

function pointOnOrbit(a: number, e: number, angleDeg: number): Pt {
  const c = ellipseCenterFromLeftFocus(STAR, a, e);
  const t = (angleDeg * Math.PI) / 180;
  return { x: c.x + a * Math.cos(t), y: c.y + a * RY_RATIO * Math.sin(t) };
}

export const NODES: NodeDescriptor[] = [
  {
    id: 'perihelion',
    label: 'PERIHELION',
    kind: 'primary',
    colorVar: 'color-perihelion',
    position: vertexAt(STAR, ORBITS.inner.a, ORBITS.inner.e, 'perihelion'),
  },
  {
    id: 'aphelion',
    label: 'APHELION',
    kind: 'primary',
    colorVar: 'color-aphelion',
    position: vertexAt(STAR, ORBITS.middle.a, ORBITS.middle.e, 'aphelion'),
  },
  {
    id: 'cloudflare',
    label: 'CLOUDFLARE',
    kind: 'outer',
    colorVar: 'color-cloudflare',
    position: pointOnOrbit(ORBITS.outer.a, ORBITS.outer.e, 155),
  },
  {
    id: 'gce',
    label: 'GCE',
    kind: 'outer',
    colorVar: 'color-gce',
    position: pointOnOrbit(ORBITS.outer.a, ORBITS.outer.e, 35),
  },
];

export function findNode(id: string): NodeDescriptor | undefined {
  return NODES.find((n) => n.id === id);
}

export const SYSTEM_SCALE = 1;
export const PLANET_SCALE = 2.5;
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/layout.ts
git commit -m "feat(solar-system): layout constants + node positions"
```

---

## Task 7: Star component

**Files:**
- Create: `client/src/components/SolarSystem/Star.tsx`

- [ ] **Step 1: Implement**

```tsx
import { STAR } from './layout';

export function Star() {
  return (
    <g aria-hidden>
      <circle cx={STAR.x} cy={STAR.y} r={6}  fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={0.6} />
      <circle cx={STAR.x} cy={STAR.y} r={14} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={0.4} />
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Star.tsx
git commit -m "feat(solar-system): Star placeholder component"
```

---

## Task 8: Orbit component

**Files:**
- Create: `client/src/components/SolarSystem/Orbit.tsx`

- [ ] **Step 1: Implement**

```tsx
import { STAR, ORBITS, type OrbitKey } from './layout';
import { ellipseCenterFromLeftFocus } from '../../lib/geometry';

const RY_RATIO = 0.347;

export function Orbit({ which }: { which: OrbitKey }) {
  const { a, e } = ORBITS[which];
  const c = ellipseCenterFromLeftFocus(STAR, a, e);
  const opacity = which === 'inner' ? 0.08 : which === 'middle' ? 0.06 : 0.05;
  return (
    <ellipse
      cx={c.x} cy={c.y} rx={a} ry={a * RY_RATIO}
      fill="none"
      stroke={`rgba(255,255,255,${opacity})`}
      strokeWidth={0.5}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Orbit.tsx
git commit -m "feat(solar-system): Orbit ellipse component"
```

---

## Task 9: Primary Planet wireframe

**Files:**
- Create: `client/src/components/SolarSystem/Planet/index.tsx`

- [ ] **Step 1: Implement**

```tsx
interface PlanetProps {
  x: number;
  y: number;
  colorVar: string;          // e.g. 'color-perihelion' (without the `--`)
  radius?: number;
  onClick?: () => void;
  hintSatellites?: boolean;  // small dots at system zoom
}

export function Planet({ x, y, colorVar, radius = 16, onClick, hintSatellites = true }: PlanetProps) {
  const stroke = `var(--${colorVar})`;
  return (
    <g data-planet transform={`translate(${x} ${y})`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <circle r={radius + 4} fill="none" stroke={stroke} strokeOpacity={0.15} strokeWidth={0.5} />
      <circle data-outline r={radius} fill="none" stroke={stroke} strokeWidth={0.5} />
      <ellipse rx={radius} ry={radius} fill="none" stroke={stroke} strokeWidth={0.4} transform="skewX(20) rotate(15)" />
      <ellipse rx={radius} ry={radius} fill="none" stroke={stroke} strokeWidth={0.4} transform="skewX(-20) rotate(-15)" />
      <circle r={2} fill={stroke} />
      {hintSatellites && (
        <g>
          <circle cx={radius + 4} cy={-3} r={1} fill={stroke} />
          <circle cx={-radius - 2} cy={5} r={1} fill={stroke} />
          <circle cx={0} cy={-radius - 4} r={1} fill={stroke} />
        </g>
      )}
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Planet/index.tsx
git commit -m "feat(solar-system): primary Planet wireframe"
```

---

## Task 10: OuterPlanet component

**Files:**
- Create: `client/src/components/SolarSystem/Planet/OuterPlanet.tsx`

- [ ] **Step 1: Implement**

```tsx
interface OuterPlanetProps {
  x: number;
  y: number;
  colorVar: string;
  label: string;
  onClick?: () => void;
}

export function OuterPlanet({ x, y, colorVar, label, onClick }: OuterPlanetProps) {
  const stroke = `var(--${colorVar})`;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <g data-outer-planet transform={`translate(${x} ${y})`}>
        <circle r={9} fill="none" stroke={stroke} strokeWidth={0.4} />
        <ellipse rx={9} ry={9} fill="none" stroke={stroke} strokeWidth={0.3} transform="skewX(20)" />
        <circle r={1.2} fill={stroke} />
      </g>
      <text x={x} y={y + 25} textAnchor="middle" fontSize={8} fontFamily="ui-monospace, Menlo, monospace" letterSpacing={1} fill={stroke} fillOpacity={0.85}>
        {label}
      </text>
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Planet/OuterPlanet.tsx
git commit -m "feat(solar-system): OuterPlanet small variant"
```

---

## Task 11: Satellites component

**Files:**
- Create: `client/src/components/SolarSystem/Planet/Satellites.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { Service } from '@apseline/shared';
import { satelliteSlotsForTier } from '../../../lib/geometry';

const TIER_RADII = [110, 155, 195];
const TIER_COUNT = TIER_RADII.length;
const TIER_PHASE = [0, Math.PI / 5, Math.PI / 3];

export interface SatelliteSlot {
  service: Service;
  tier: number;
  x: number;
  y: number;
  size: number;
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function distributeSatellites(services: Service[]): SatelliteSlot[] {
  const buckets: Service[][] = Array.from({ length: TIER_COUNT }, () => []);
  const sorted = [...services].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach((s, i) => buckets[i % TIER_COUNT].push(s));

  const slots: SatelliteSlot[] = [];
  buckets.forEach((tierServices, tier) => {
    const positions = satelliteSlotsForTier(tierServices.length, TIER_RADII[tier], TIER_PHASE[tier]);
    tierServices.forEach((service, i) => {
      const sizeRoll = (hashName(service.name) % 3) + 2;  // 2..4 px
      slots.push({ service, tier, x: positions[i].x, y: positions[i].y, size: sizeRoll });
    });
  });
  return slots;
}

interface SatellitesProps {
  services: Service[];
  colorVar: string;
  opacity: number;
  onSelect: (serviceId: string) => void;
}

export function Satellites({ services, colorVar, opacity, onSelect }: SatellitesProps) {
  const slots = distributeSatellites(services);
  const fill = `var(--${colorVar})`;
  return (
    <g style={{ opacity }}>
      {slots.map(({ service, x, y, size }) => (
        <g key={service.name}>
          <circle
            data-satellite
            cx={x} cy={y} r={size}
            fill={fill}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(service.name)}
          />
          <text
            x={x + size + 4} y={y + 3}
            fontSize={7} fontFamily="ui-monospace, Menlo, monospace"
            fill={fill} fillOpacity={0.9}
            style={{ pointerEvents: 'none' }}
          >
            {service.name}
          </text>
        </g>
      ))}
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Planet/Satellites.tsx
git commit -m "feat(solar-system): Satellites with tier distribution"
```

---

## Task 12: Chrome — Brackets

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/Brackets.tsx`

- [ ] **Step 1: Implement**

```tsx
import { VIEWBOX_W, VIEWBOX_H } from '../layout';

const STROKE = 'rgba(255,255,255,0.22)';
const W = 0.6;

export function Brackets() {
  return (
    <g aria-hidden stroke={STROKE} strokeWidth={W} fill="none">
      <path d={`M 12 12 L 12 32 M 12 12 L 32 12`} />
      <path d={`M ${VIEWBOX_W - 12} 12 L ${VIEWBOX_W - 12} 32 M ${VIEWBOX_W - 12} 12 L ${VIEWBOX_W - 32} 12`} />
      <path d={`M 12 ${VIEWBOX_H - 12} L 12 ${VIEWBOX_H - 32} M 12 ${VIEWBOX_H - 12} L 32 ${VIEWBOX_H - 12}`} />
      <path d={`M ${VIEWBOX_W - 12} ${VIEWBOX_H - 12} L ${VIEWBOX_W - 12} ${VIEWBOX_H - 32} M ${VIEWBOX_W - 12} ${VIEWBOX_H - 12} L ${VIEWBOX_W - 32} ${VIEWBOX_H - 12}`} />
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Chrome/Brackets.tsx
git commit -m "feat(chrome): corner brackets"
```

---

## Task 13: Chrome — Header (top label + clock)

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/Header.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react';
import type { View } from '../../../stores/viewStore';
import { findNode, VIEWBOX_W } from '../layout';

function fmtClock(d: Date) {
  const z = (n: number) => n.toString().padStart(2, '0');
  return `${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())}Z`;
}

function headerLines(view: View): { primary: string; secondary: string } {
  if (view.kind === 'system') {
    return { primary: 'APSELINE ▸ SYSTEM', secondary: 'NODES: 4 / SVCS: — / OK' };
  }
  const node = findNode(view.nodeId);
  return { primary: `${node?.label ?? '—'} ▸ NODE`, secondary: 'CPU — · MEM — · UP —' };
}

export function Header({ view }: { view: View }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const { primary, secondary } = headerLines(view);
  const accentVar =
    view.kind === 'system' ? null : findNode(view.nodeId)?.colorVar ?? 'color-perihelion';
  const accent = accentVar ? `var(--${accentVar})` : 'rgba(160,145,214,0.85)';

  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={9} letterSpacing={1}>
      <text x={20} y={28} fill={accent}>{primary}</text>
      <text x={20} y={42} fill="rgba(255,255,255,0.5)">{secondary}</text>
      <text x={VIEWBOX_W - 20} y={28} textAnchor="end" fill="rgba(255,255,255,0.5)">{fmtClock(now)}</text>
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Chrome/Header.tsx
git commit -m "feat(chrome): top header with view-aware label + UTC clock"
```

---

## Task 14: Chrome — Telemetry

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/Telemetry.tsx`

- [ ] **Step 1: Implement**

```tsx
import { VIEWBOX_H } from '../layout';

interface TelemetryProps {
  netUp?: string;
  netDown?: string;
  diskUsed?: string;
  diskTotal?: string;
  serviceCount?: number;
}

export function Telemetry({
  netUp = '— Mbps',
  netDown = '— Mbps',
  diskUsed = '—',
  diskTotal = '—',
  serviceCount = 0,
}: TelemetryProps) {
  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={8} letterSpacing={0.5} fill="rgba(255,255,255,0.4)">
      <text x={20} y={VIEWBOX_H - 32}>{`NET ↑ ${netUp}  ↓ ${netDown}`}</text>
      <text x={20} y={VIEWBOX_H - 18}>{`DISK ${diskUsed} / ${diskTotal} · ${serviceCount} svcs`}</text>
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Chrome/Telemetry.tsx
git commit -m "feat(chrome): bottom-left telemetry strip"
```

---

## Task 15: Chrome — UtilityDock

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/UtilityDock.tsx`

- [ ] **Step 1: Implement**

```tsx
import { VIEWBOX_W, VIEWBOX_H } from '../layout';

export type UtilityItemId = 'settings' | 'logs' | 'discovery' | 'alerts';

interface DockProps {
  alertCount?: number;
  onItem: (id: UtilityItemId) => void;
}

const ROW_Y_TOP = VIEWBOX_H - 35;
const ROW_Y_BOT = VIEWBOX_H - 19;
const COLS = [VIEWBOX_W - 200, VIEWBOX_W - 140, VIEWBOX_W - 97];

function DockItem({ x, y, pip, fill, label, onClick }: { x: number; y: number; pip: string; fill: string; label: string; onClick: () => void }) {
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      <circle cx={x} cy={y - 3} r={2} fill={pip} />
      <text x={x + 8} y={y} fill={fill}>{label}</text>
    </g>
  );
}

export function UtilityDock({ alertCount = 0, onItem }: DockProps) {
  const dim = 'rgba(255,255,255,0.5)';
  const dimPip = 'rgba(255,255,255,0.35)';
  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={8} letterSpacing={0.5}>
      <DockItem x={COLS[0]} y={ROW_Y_TOP} pip={dimPip} fill={dim} label="settings" onClick={() => onItem('settings')} />
      <DockItem x={COLS[1]} y={ROW_Y_TOP} pip={dimPip} fill={dim} label="logs"     onClick={() => onItem('logs')} />
      <DockItem x={COLS[2]} y={ROW_Y_TOP} pip={dimPip} fill={dim} label="discovery" onClick={() => onItem('discovery')} />
      <DockItem x={COLS[0]} y={ROW_Y_BOT} pip="var(--color-alerts)" fill="var(--color-alerts)" label={`alerts · ${alertCount}`} onClick={() => onItem('alerts')} />
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Chrome/UtilityDock.tsx
git commit -m "feat(chrome): bottom-right utility dock"
```

---

## Task 16: Camera component

**Files:**
- Create: `client/src/components/SolarSystem/Camera.tsx`

- [ ] **Step 1: Implement**

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { View } from '../../stores/viewStore';
import { findNode, STAR, VIEWBOX_W, VIEWBOX_H, PLANET_SCALE, SYSTEM_SCALE } from './layout';
import {
  quadBezier, easeInOutCubic, lerp,
  SWOOP_DURATION_MS, ZOOM_IN_DURATION_MS, ZOOM_OUT_DURATION_MS,
} from '../../lib/transitions';
import type { Pt } from '../../lib/geometry';

export interface CameraTarget { x: number; y: number; scale: number }

const SYSTEM_CENTER: Pt = { x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 };
const APEX: Pt = { x: STAR.x, y: STAR.y - 200 };

export function computeCameraTarget(view: View): CameraTarget {
  if (view.kind === 'system') return { x: SYSTEM_CENTER.x, y: SYSTEM_CENTER.y, scale: SYSTEM_SCALE };
  const node = findNode(view.nodeId);
  if (!node) return { x: SYSTEM_CENTER.x, y: SYSTEM_CENTER.y, scale: SYSTEM_SCALE };
  return { x: node.position.x, y: node.position.y, scale: PLANET_SCALE };
}

function durationFor(prev: View, next: View): number {
  if (prev.kind === 'system' && next.kind === 'planet') return ZOOM_IN_DURATION_MS;
  if (prev.kind === 'planet' && next.kind === 'system') return ZOOM_OUT_DURATION_MS;
  if (prev.kind === 'planet' && next.kind === 'planet' && prev.nodeId !== next.nodeId) return SWOOP_DURATION_MS;
  return 0;
}

interface CameraProps {
  view: View;
  transitionId: number;
  children: React.ReactNode;
}

export function Camera({ view, transitionId, children }: CameraProps) {
  const reduced = !!useReducedMotion();
  const [cam, setCam] = useState<CameraTarget>(() => computeCameraTarget(view));
  const camRef = useRef(cam);
  camRef.current = cam;
  const prevViewRef = useRef<View>(view);

  useEffect(() => {
    const prev = prevViewRef.current;
    const next = view;
    prevViewRef.current = next;
    const to = computeCameraTarget(next);
    const from = camRef.current;
    const duration = reduced ? 0 : durationFor(prev, next);
    const useApex = !reduced && prev.kind === 'planet' && next.kind === 'planet' && prev.nodeId !== next.nodeId;
    if (duration === 0) { setCam(to); return; }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(raw);
      const pos = useApex
        ? quadBezier(eased, from, APEX, to)
        : { x: lerp(from.x, to.x, eased), y: lerp(from.y, to.y, eased) };
      const scale = useApex
        ? (raw < 0.5
            ? lerp(from.scale, SYSTEM_SCALE, eased * 2)
            : lerp(SYSTEM_SCALE, to.scale, (eased - 0.5) * 2))
        : lerp(from.scale, to.scale, eased);
      setCam({ x: pos.x, y: pos.y, scale });
      if (raw < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionId, reduced]);

  const tx = useMemo(() => VIEWBOX_W / 2 - cam.x * cam.scale, [cam.x, cam.scale]);
  const ty = useMemo(() => VIEWBOX_H / 2 - cam.y * cam.scale, [cam.y, cam.scale]);
  return (
    <motion.g transform={`translate(${tx} ${ty}) scale(${cam.scale})`}>{children}</motion.g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SolarSystem/Camera.tsx
git commit -m "feat(camera): rAF-driven camera with bezier swoop + reduced-motion"
```

---

## Task 17: SolarSystem composition

**Files:**
- Create: `client/src/components/SolarSystem/index.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState, useEffect } from 'react';
import { useViewStore, type View } from '../../stores/viewStore';
import { useServicesStore } from '../../stores/servicesStore';
import { Camera } from './Camera';
import { Star } from './Star';
import { Orbit } from './Orbit';
import { Planet } from './Planet';
import { OuterPlanet } from './Planet/OuterPlanet';
import { Satellites } from './Planet/Satellites';
import { Brackets } from './Chrome/Brackets';
import { Header } from './Chrome/Header';
import { Telemetry } from './Chrome/Telemetry';
import { UtilityDock } from './Chrome/UtilityDock';
import { NODES, VIEWBOX_W, VIEWBOX_H, findNode } from './layout';
import { ZOOM_IN_DURATION_MS, SWOOP_DURATION_MS, SATELLITE_FADE_MS } from '../../lib/transitions';

function useSatelliteFade(view: View, transitionId: number) {
  const [op, setOp] = useState(view.kind === 'planet' || view.kind === 'service' ? 1 : 0);
  useEffect(() => {
    if (view.kind === 'system') { setOp(0); return; }
    const total = view.kind === 'planet' ? ZOOM_IN_DURATION_MS : SWOOP_DURATION_MS;
    const fadeStart = total - SATELLITE_FADE_MS;
    setOp(0);
    let raf = 0;
    const t1 = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SATELLITE_FADE_MS);
        setOp(t);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, fadeStart);
    return () => { clearTimeout(t1); cancelAnimationFrame(raf); };
  }, [transitionId, view.kind]);
  return op;
}

export function SolarSystem() {
  const { view, transitionId, navigate, openService } = useViewStore();
  const services = useServicesStore((s) => s.services);
  const satOpacity = useSatelliteFade(view, transitionId);

  const activeNodeId = view.kind === 'planet' || view.kind === 'service' ? view.nodeId : null;
  const activeNode = activeNodeId ? findNode(activeNodeId) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--color-bg)' }}>
      <svg viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <Camera view={view} transitionId={transitionId}>
          <Orbit which="inner" />
          <Orbit which="middle" />
          <Orbit which="outer" />
          <Star />
          {NODES.filter(n => n.kind === 'primary').map(n => (
            <Planet key={n.id}
              x={n.position.x} y={n.position.y}
              colorVar={n.colorVar}
              radius={n.id === 'aphelion' ? 20 : 16}
              hintSatellites={view.kind === 'system'}
              onClick={() => navigate({ kind: 'planet', nodeId: n.id })}
            />
          ))}
          {NODES.filter(n => n.kind === 'outer').map(n => (
            <OuterPlanet key={n.id}
              x={n.position.x} y={n.position.y}
              colorVar={n.colorVar} label={n.label}
              onClick={() => navigate({ kind: 'planet', nodeId: n.id })}
            />
          ))}
          {activeNode && (
            <g transform={`translate(${activeNode.position.x} ${activeNode.position.y})`}>
              <Satellites
                services={services.filter(s => s.infrastructure === activeNode.id)}
                colorVar={activeNode.colorVar}
                opacity={satOpacity}
                onSelect={openService}
              />
            </g>
          )}
        </Camera>

        <Brackets />
        <Header view={view} />
        <Telemetry serviceCount={services.length} />
        <UtilityDock alertCount={0} onItem={() => { /* wired in later task */ }} />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Smoke**

Run from `client/`: `pnpm dev`. Note: services data won't render yet because `App.tsx` still uses the old structure — that's wired up in Task 21. For now confirm the file compiles by running `pnpm build` from `client/`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SolarSystem/index.tsx
git commit -m "feat(solar-system): SolarSystem composition with camera + chrome"
```

---

## Task 18: ServiceModal (frame, callout, highlight)

**Files:**
- Create: `client/src/components/SolarSystem/ServiceModal/CalloutLine.tsx`
- Create: `client/src/components/SolarSystem/ServiceModal/SatelliteHighlight.tsx`
- Create: `client/src/components/SolarSystem/ServiceModal/index.tsx`
- Modify: `client/src/components/SolarSystem/index.tsx`

- [ ] **Step 1: Implement CalloutLine**

```tsx
interface CalloutLineProps {
  fromX: number; fromY: number; toX: number; toY: number; colorVar: string;
}

export function CalloutLine({ fromX, fromY, toX, toY, colorVar }: CalloutLineProps) {
  const midX = (fromX + toX) / 2;
  return (
    <path
      d={`M ${fromX} ${fromY} L ${midX} ${fromY} L ${toX} ${toY}`}
      fill="none"
      stroke={`var(--${colorVar})`}
      strokeOpacity={0.5}
      strokeWidth={0.4}
    />
  );
}
```

- [ ] **Step 2: Implement SatelliteHighlight**

```tsx
interface Props { x: number; y: number; colorVar: string }
export function SatelliteHighlight({ x, y, colorVar }: Props) {
  const stroke = `var(--${colorVar})`;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <circle r={9}  fill="none" stroke={stroke} strokeWidth={0.6} />
      <circle r={14} fill="none" stroke={stroke} strokeOpacity={0.4} strokeDasharray="2 3" strokeWidth={0.4} />
    </g>
  );
}
```

- [ ] **Step 3: Implement ServiceModal/index.tsx**

```tsx
import { useEffect } from 'react';
import type { Service } from '@apseline/shared';
import { useViewStore } from '../../../stores/viewStore';
import { findNode } from '../layout';

interface ServiceModalProps {
  nodeId: string;
  serviceId: string;
  services: Service[];
}

function hostnameOf(url: string) { try { return new URL(url).host; } catch { return url; } }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)' }}>
      <span>{label}</span><span style={{ color: '#fff' }}>{value}</span>
    </div>
  );
}

const modalShellStyle: React.CSSProperties = {
  position: 'fixed', top: 30, right: 30, zIndex: 10,
  fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.7)',
};
const modalFrameStyle: React.CSSProperties = {
  width: 340, background: 'rgba(10,10,20,0.92)', border: '1px solid', padding: 0,
};
const modalHeaderStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px 12px',
};
const modalBodyStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 11, lineHeight: 1.7 };
const primaryBtn = (colorVar: string): React.CSSProperties => ({
  flex: 1, background: `color-mix(in srgb, var(--${colorVar}) 15%, transparent)`,
  border: `1px solid var(--${colorVar})`, color: `var(--${colorVar})`,
  padding: 8, fontSize: 10, letterSpacing: 1.5, fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none',
});
const ghostBtn: React.CSSProperties = {
  flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)', padding: 8, fontSize: 10, letterSpacing: 1.5, fontFamily: 'inherit',
};

export function ServiceModal({ nodeId, serviceId, services }: ServiceModalProps) {
  const closeService = useViewStore((s) => s.closeService);
  const node = findNode(nodeId);
  const service = services.find((s) => s.name === serviceId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeService(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeService]);

  if (!node || !service) return null;

  return (
    <div style={modalShellStyle}>
      <div style={{ ...modalFrameStyle, borderColor: `var(--${node.colorVar})` }}>
        <div style={modalHeaderStyle}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: `var(--${node.colorVar})` }}>
            {node.label} ▸ SVC ▸ {service.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 18, color: '#fff', marginTop: 4, letterSpacing: 0.5 }}>
            {service.name}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              {service.category ?? '—'} · {hostnameOf(service.url)}
            </span>
          </div>
        </div>
        <div style={modalBodyStyle}>
          <Row label="STATUS" value={service.status ?? 'unknown'} />
          <Row label="HOST" value={hostnameOf(service.url)} />
          <Row label="SOURCE" value={service.source ?? 'manual'} />
          <Row label="CATEGORY" value={service.category ?? '—'} />
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <a href={service.url} target="_blank" rel="noreferrer" style={primaryBtn(node.colorVar)}>▸ OPEN</a>
            <button style={ghostBtn} onClick={closeService}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire modal + dim into SolarSystem**

In `client/src/components/SolarSystem/index.tsx` add imports near the top:

```tsx
import { ServiceModal } from './ServiceModal';
import { SatelliteHighlight } from './ServiceModal/SatelliteHighlight';
import { distributeSatellites } from './Planet/Satellites';
```

Inside the `<svg>` after `<UtilityDock …/>`, append:

```tsx
{view.kind === 'service' && activeNode && (() => {
  const list = services.filter(s => s.infrastructure === view.nodeId);
  const slot = distributeSatellites(list).find(s => s.service.name === view.serviceId);
  return (
    <>
      <rect x={0} y={0} width={VIEWBOX_W} height={VIEWBOX_H} fill="rgba(10,10,20,0.55)" pointerEvents="none" />
      {slot && (
        <g transform={`translate(${activeNode.position.x} ${activeNode.position.y})`}>
          <SatelliteHighlight x={slot.x} y={slot.y} colorVar={activeNode.colorVar} />
        </g>
      )}
    </>
  );
})()}
```

After the `</svg>` (still inside the outer `<div>`), append:

```tsx
{view.kind === 'service' && (
  <ServiceModal nodeId={view.nodeId} serviceId={view.serviceId} services={services} />
)}
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/SolarSystem/ServiceModal client/src/components/SolarSystem/index.tsx
git commit -m "feat(modal): service detail modal with callout + dim backdrop"
```

---

## Task 19: Retune OrbitalBackground to use theme variables

**Files:**
- Modify: `client/src/components/OrbitalBackground.tsx`

- [ ] **Step 1: Replace `getColors()` with theme-var-driven version**

In `OrbitalBackground.tsx`, replace the `getColors` function with:

```ts
const getColors = () => {
  const root = getComputedStyle(document.documentElement);
  const hex = (infrastructure === 'perihelion'
    ? root.getPropertyValue('--color-perihelion')
    : root.getPropertyValue('--color-aphelion')).trim() || '#DA79B0';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { particle: `rgba(${r}, ${g}, ${b}, ` };
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/OrbitalBackground.tsx
git commit -m "chore(bg): retune particle color to theme vars"
```

---

## Task 20: ThemePicker + SettingsPanel

**Files:**
- Create: `client/src/components/SolarSystem/Settings/ThemePicker.tsx`
- Create: `client/src/components/SolarSystem/Settings/SettingsPanel.tsx`
- Modify: `client/src/components/SolarSystem/index.tsx`

- [ ] **Step 1: Implement ThemePicker**

```tsx
import { THEMES, type ThemeId } from '../../../lib/palette';
import { useThemeStore } from '../../../stores/themeStore';

export function ThemePicker() {
  const { themeId, setTheme } = useThemeStore();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {(Object.keys(THEMES) as ThemeId[]).map((id) => {
        const t = THEMES[id];
        const active = id === themeId;
        return (
          <button key={id} onClick={() => setTheme(id)}
            style={{
              background: t.bg, border: active ? `1px solid ${t.perihelion}` : '1px solid rgba(255,255,255,0.1)',
              padding: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'ui-monospace, Menlo, monospace',
              color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 1,
            }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {[t.perihelion, t.aphelion, t.cloudflare, t.gce, t.warn, t.alerts].map((c, i) => (
                <span key={i} style={{ width: 10, height: 10, background: c, display: 'inline-block' }} />
              ))}
            </div>
            <div>{id}</div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement SettingsPanel**

```tsx
import { ThemePicker } from './ThemePicker';

interface Props { open: boolean; onClose: () => void }
export function SettingsPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 30, left: 30, zIndex: 20,
      width: 380, padding: 16,
      background: 'rgba(10,10,20,0.92)', border: '1px solid rgba(255,255,255,0.15)',
      fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.7)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(160,145,214,0.85)' }}>SETTINGS ▸ THEME</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>✕</button>
      </div>
      <ThemePicker />
    </div>
  );
}
```

- [ ] **Step 3: Wire into SolarSystem**

Add to imports in `SolarSystem/index.tsx`:

```tsx
import { SettingsPanel } from './Settings/SettingsPanel';
```

Inside the component, add state:

```tsx
const [openPanel, setOpenPanel] = useState<null | 'settings' | 'logs' | 'discovery' | 'alerts'>(null);
```

Replace the `<UtilityDock alertCount={0} onItem={...}/>` line with:

```tsx
<UtilityDock alertCount={0} onItem={(id) => setOpenPanel(id)} />
```

After the existing `view.kind === 'service'` modal block (still inside the outer `<div>`), append:

```tsx
<SettingsPanel open={openPanel === 'settings'} onClose={() => setOpenPanel(null)} />
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/SolarSystem/Settings client/src/components/SolarSystem/index.tsx
git commit -m "feat(settings): theme picker with 6 themes"
```

---

## Task 21: Boot wiring + delete obsolete components

**Files:**
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.tsx`
- Delete: `client/src/components/Header.tsx`, `ServiceCard.tsx`, `ServiceGrid.tsx`

- [ ] **Step 1: Apply theme on boot**

In `client/src/main.tsx`, add after imports and before `ReactDOM.createRoot(...)`:

```tsx
import { useThemeStore } from './stores/themeStore';
useThemeStore.getState().initFromStorage();
```

- [ ] **Step 2: Replace App body**

Overwrite `client/src/App.tsx`:

```tsx
import { useEffect } from 'react';
import { useServicesStore } from './stores/servicesStore';
import { SolarSystem } from './components/SolarSystem';
import { OrbitalBackground } from './components/OrbitalBackground';

function App() {
  const { fetchConfig, fetchServices, fetchDiscoveryStatus, connectSocket, activeInfra } = useServicesStore();

  useEffect(() => {
    fetchConfig();
    fetchServices();
    fetchDiscoveryStatus();
    const disconnect = connectSocket();
    return disconnect;
  }, [fetchConfig, fetchServices, fetchDiscoveryStatus, connectSocket]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <OrbitalBackground infrastructure={activeInfra} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <SolarSystem />
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Delete obsolete components**

```bash
rm client/src/components/Header.tsx client/src/components/ServiceCard.tsx client/src/components/ServiceGrid.tsx
```

- [ ] **Step 4: Build & smoke test**

```bash
cd client && pnpm build && pnpm dev
```

Expected: build clean; dev server shows the new solar-system view; clicking Perihelion zooms in; clicking Aphelion swoops; Esc closes the modal; settings dock opens the theme picker; reduced-motion (DevTools rendering tab) disables camera moves.

- [ ] **Step 5: Commit**

```bash
git add client/src/main.tsx client/src/App.tsx
git rm client/src/components/Header.tsx client/src/components/ServiceCard.tsx client/src/components/ServiceGrid.tsx
git commit -m "feat: replace dashboard with solar-system; remove obsolete grid components"
```

---

## Task 22: Acceptance pass

- [ ] **Step 1: Build**

```bash
cd client && pnpm build
```

Expected: tsc + vite build clean.

- [ ] **Step 2: Manual acceptance against spec §10**

Verify each line in [`docs/superpowers/specs/2026-05-01-orbital-redesign-design.md`](../specs/2026-05-01-orbital-redesign-design.md) §10:

1. Default landing renders system view with star, three orbits, Perihelion at left vertex, Aphelion at right vertex, two outer planets visible.
2. Clicking a primary planet performs the §4.1 zoom-in dolly to a planet view in ≤ 600ms.
3. Clicking a different primary planet from a planet view performs the §4.2 swoop in ≤ 800ms with chrome cross-fade at the apex.
4. Clicking a satellite opens the §5 modal anchored top-right.
5. Bottom-left telemetry and bottom-right utility dock render and are sized within ±2px of each other's baseline.
6. Theme picker switches between the six themes with no flash.
7. `prefers-reduced-motion: reduce` disables all camera moves; navigation still works.
8. All transitions sustain 60fps on a 2020-era laptop in Chrome and Firefox.

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "chore: orbital redesign complete (acceptance pass)"
```
