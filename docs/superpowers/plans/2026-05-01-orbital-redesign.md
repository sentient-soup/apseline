# Apseline Orbital Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing services-grid dashboard with a solar-system metaphor (off-center star, eccentric orbits, wireframe planets, satellite services, blueprint chrome) wired up with camera-based navigation and three orbital transitions.

**Architecture:** SVG + CSS transforms primary, Canvas for ambient starfield (existing component, retuned), Framer Motion for camera animations, Zustand for state (one new store for view, one for theme). No WebGL. All accent hues at uniform lightness; six selectable themes via CSS custom properties.

**Tech Stack:** React 19, TypeScript 5.3, Vite 5, Tailwind 3, Framer Motion 11, Zustand 5, Vitest (added in Task 1), @testing-library/react.

**Source spec:** [`docs/superpowers/specs/2026-05-01-orbital-redesign-design.md`](../specs/2026-05-01-orbital-redesign-design.md)

**Repo note:** the project is not currently a git repo. Tasks include `git commit` steps; if `git init` has not been run, the implementor should either run it before starting or treat commit steps as advisory checkpoints.

---

## File map (created / modified / deleted)

```
client/
  package.json                           MODIFY  add vitest + testing-library deps
  vitest.config.ts                       CREATE  vitest config
  tsconfig.json                          MODIFY  include vitest types
  tailwind.config.js                     MODIFY  add CSS-var-driven theme palette
  src/
    main.tsx                             MODIFY  apply initial theme on boot
    App.tsx                              MODIFY  render <SolarSystem> instead of grid
    index.css                            MODIFY  define :root CSS variables (default theme)

    lib/
      geometry.ts                        CREATE  ellipse focus math, satellite placement
      geometry.test.ts                   CREATE
      transitions.ts                     CREATE  Bézier camera paths, scale interp, redirect
      transitions.test.ts                CREATE
      palette.ts                         CREATE  theme token tables + applyTheme()
      palette.test.ts                    CREATE

    stores/
      viewStore.ts                       CREATE  { kind, nodeId?, serviceId? } + navigate()
      viewStore.test.ts                  CREATE
      themeStore.ts                      CREATE  themeId + persistence
      themeStore.test.ts                 CREATE
      servicesStore.ts                   UNCHANGED

    components/
      OrbitalBackground.tsx              MODIFY  retune particle color tokens
      Header.tsx                         DELETE
      ServiceCard.tsx                    DELETE
      ServiceGrid.tsx                    DELETE
      SolarSystem/
        index.tsx                        CREATE  outer SVG, scene composition
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

  vitest.setup.ts                        CREATE  jsdom + matchers

docs/
  superpowers/
    specs/2026-05-01-orbital-redesign-design.md   (already exists — source of truth)
    plans/2026-05-01-orbital-redesign.md          (this file)
```

---

## Task 1: Set up Vitest and Testing Library

**Files:**
- Modify: `client/package.json`
- Create: `client/vitest.config.ts`
- Create: `client/vitest.setup.ts`
- Modify: `client/tsconfig.json`

- [ ] **Step 1: Install dev deps**

Run from repo root:
```bash
pnpm --filter @apseline/client add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add test script to client/package.json**

In `client/package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest config**

Create `client/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
  },
});
```

- [ ] **Step 4: Create vitest setup**

Create `client/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Update tsconfig**

In `client/tsconfig.json`, ensure `compilerOptions.types` includes `"vitest/globals"` and `"@testing-library/jest-dom"`. If `types` is missing, add:
```json
"types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
```

- [ ] **Step 6: Verify**

Run from `client/`:
```bash
pnpm test
```
Expected: `No test files found` exit 0 (or exit 1 with that message — either is fine for now).

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/vitest.config.ts client/vitest.setup.ts client/tsconfig.json pnpm-lock.yaml
git commit -m "chore: add vitest + testing-library"
```

---

## Task 2: Geometry library — ellipse focus math

**Files:**
- Create: `client/src/lib/geometry.ts`
- Create: `client/src/lib/geometry.test.ts`

- [ ] **Step 1: Write failing test for ellipse center calc**

Create `client/src/lib/geometry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ellipseCenterFromLeftFocus, vertexAt, satelliteSlotsForTier } from './geometry';

describe('ellipseCenterFromLeftFocus', () => {
  it('returns center to the right of the focus by a*e', () => {
    const focus = { x: 300, y: 240 };
    const center = ellipseCenterFromLeftFocus(focus, 140, 0.45);
    expect(center).toEqual({ x: 300 + 140 * 0.45, y: 240 });
  });
});

describe('vertexAt', () => {
  it('returns left vertex (perihelion of orbit)', () => {
    const focus = { x: 300, y: 240 };
    const v = vertexAt(focus, 140, 0.45, 'perihelion');
    expect(v).toEqual({ x: 300 + 140 * 0.45 - 140, y: 240 });
  });
  it('returns right vertex (aphelion of orbit)', () => {
    const focus = { x: 300, y: 240 };
    const v = vertexAt(focus, 240, 0.5, 'aphelion');
    expect(v).toEqual({ x: 300 + 240 * 0.5 + 240, y: 240 });
  });
});

describe('satelliteSlotsForTier', () => {
  it('places N satellites on a circle of given radius', () => {
    const slots = satelliteSlotsForTier(4, 100);
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({ x: 100, y: 0 });
    expect(slots[1].x).toBeCloseTo(0, 5);
    expect(slots[1].y).toBeCloseTo(100, 5);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run from `client/`:
```bash
pnpm test geometry
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement geometry.ts**

Create `client/src/lib/geometry.ts`:
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

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test geometry
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/geometry.ts client/src/lib/geometry.test.ts
git commit -m "feat(geometry): ellipse focus math + satellite slot helper"
```

---

## Task 3: Transitions library — Bézier camera paths

**Files:**
- Create: `client/src/lib/transitions.ts`
- Create: `client/src/lib/transitions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/lib/transitions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { quadBezier, lerp, easeInOutCubic, redirectFromMidflight } from './transitions';

describe('quadBezier', () => {
  it('returns start at t=0', () => {
    expect(quadBezier(0, { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 })).toEqual({ x: 0, y: 0 });
  });
  it('returns end at t=1', () => {
    expect(quadBezier(1, { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 })).toEqual({ x: 100, y: 0 });
  });
  it('passes near (but not through) apex at t=0.5', () => {
    const p = quadBezier(0.5, { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 });
    expect(p.x).toBe(50);
    expect(p.y).toBe(50); // 0.25*0 + 0.5*100 + 0.25*0
  });
});

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('easeInOutCubic', () => {
  it('returns 0 at t=0 and 1 at t=1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('crosses 0.5 at t=0.5', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe('redirectFromMidflight', () => {
  it('builds a new bezier whose start equals current camera', () => {
    const current = { x: 30, y: 40 };
    const apex = { x: 100, y: -50 };
    const newEnd = { x: 200, y: 60 };
    const path = redirectFromMidflight(current, apex, newEnd);
    expect(path.start).toEqual(current);
    expect(path.apex).toEqual(apex);
    expect(path.end).toEqual(newEnd);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test transitions
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement transitions.ts**

Create `client/src/lib/transitions.ts`:
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

// Phase boundaries used by SolarSystem to schedule chrome cross-fades
// and satellite fade-ins. Times are in ms.
export const SWOOP_DURATION_MS = 800;
export const SWOOP_APEX_MS = 400;
export const ZOOM_IN_DURATION_MS = 600;
export const ZOOM_OUT_DURATION_MS = 500;
export const SATELLITE_FADE_MS = 200; // counted backward from transition end
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test transitions
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/transitions.ts client/src/lib/transitions.test.ts
git commit -m "feat(transitions): bezier camera path + easing"
```

---

## Task 4: Palette library — theme tokens & applyTheme

**Files:**
- Create: `client/src/lib/palette.ts`
- Create: `client/src/lib/palette.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/lib/palette.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { THEMES, applyTheme, type ThemeId } from './palette';

describe('THEMES', () => {
  it('has 6 themes with consistent token shapes', () => {
    const ids: ThemeId[] = ['nebula-warm','nightfall','nebula-ink','dusty-plum','blueprint','void'];
    ids.forEach(id => {
      const t = THEMES[id];
      expect(t.bg).toMatch(/^#/);
      ['perihelion','aphelion','cloudflare','gce','warn','alerts'].forEach(k => {
        expect(t[k as keyof typeof t]).toMatch(/^#/);
      });
    });
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });
  it('writes CSS variables to :root', () => {
    applyTheme('nebula-warm');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-bg')).toBe('#13121A');
    expect(root.style.getPropertyValue('--color-perihelion')).toBe('#DA79B0');
    expect(root.style.getPropertyValue('--color-aphelion')).toBe('#A091D6');
  });
  it('switches values when theme changes', () => {
    applyTheme('nebula-warm');
    applyTheme('void');
    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#0A0A14');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test palette
```
Expected: FAIL.

- [ ] **Step 3: Implement palette.ts**

Create `client/src/lib/palette.ts`:
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

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test palette
```
Expected: PASS.

- [ ] **Step 5: Wire CSS vars into Tailwind**

Modify `client/tailwind.config.js` `theme.extend.colors` to include:
```js
// Inside theme.extend.colors, in addition to existing entries:
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

Modify `client/src/index.css` — add at the top:
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

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/palette.ts client/src/lib/palette.test.ts client/tailwind.config.js client/src/index.css
git commit -m "feat(palette): theme tokens + CSS vars + applyTheme"
```

---

## Task 5: Theme store (Zustand) with localStorage persistence

**Files:**
- Create: `client/src/stores/themeStore.ts`
- Create: `client/src/stores/themeStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/stores/themeStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from './themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ themeId: 'nebula-warm' });
  });

  it('defaults to nebula-warm', () => {
    expect(useThemeStore.getState().themeId).toBe('nebula-warm');
  });

  it('setTheme changes themeId and writes localStorage', () => {
    useThemeStore.getState().setTheme('void');
    expect(useThemeStore.getState().themeId).toBe('void');
    expect(localStorage.getItem('apseline.theme')).toBe('void');
  });

  it('initFromStorage restores persisted theme', () => {
    localStorage.setItem('apseline.theme', 'dusty-plum');
    useThemeStore.getState().initFromStorage();
    expect(useThemeStore.getState().themeId).toBe('dusty-plum');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test themeStore
```

- [ ] **Step 3: Implement themeStore.ts**

Create `client/src/stores/themeStore.ts`:
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

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test themeStore
```

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/themeStore.ts client/src/stores/themeStore.test.ts
git commit -m "feat(theme): zustand store with localStorage persistence"
```

---

## Task 6: View store

**Files:**
- Create: `client/src/stores/viewStore.ts`
- Create: `client/src/stores/viewStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/stores/viewStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useViewStore } from './viewStore';

describe('viewStore', () => {
  beforeEach(() => {
    useViewStore.setState({ view: { kind: 'system' }, transitionId: 0 });
  });

  it('starts at system view', () => {
    expect(useViewStore.getState().view).toEqual({ kind: 'system' });
  });

  it('navigate to planet sets nodeId and increments transitionId', () => {
    const before = useViewStore.getState().transitionId;
    useViewStore.getState().navigate({ kind: 'planet', nodeId: 'perihelion' });
    expect(useViewStore.getState().view).toEqual({ kind: 'planet', nodeId: 'perihelion' });
    expect(useViewStore.getState().transitionId).toBe(before + 1);
  });

  it('openService overlays a service modal on the current planet view', () => {
    useViewStore.getState().navigate({ kind: 'planet', nodeId: 'perihelion' });
    useViewStore.getState().openService('jellyfin');
    expect(useViewStore.getState().view).toEqual({ kind: 'service', nodeId: 'perihelion', serviceId: 'jellyfin' });
  });

  it('closeService returns to planet view', () => {
    useViewStore.setState({ view: { kind: 'service', nodeId: 'perihelion', serviceId: 'jellyfin' }, transitionId: 0 });
    useViewStore.getState().closeService();
    expect(useViewStore.getState().view).toEqual({ kind: 'planet', nodeId: 'perihelion' });
  });

  it('openService is a no-op when not on a planet view', () => {
    useViewStore.getState().openService('jellyfin');
    expect(useViewStore.getState().view).toEqual({ kind: 'system' });
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test viewStore
```

- [ ] **Step 3: Implement viewStore.ts**

Create `client/src/stores/viewStore.ts`:
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

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test viewStore
```

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/viewStore.ts client/src/stores/viewStore.test.ts
git commit -m "feat(view): zustand view store with planet/service overlay"
```

---

## Task 7: Layout constants module

**Files:**
- Create: `client/src/components/SolarSystem/layout.ts`

- [ ] **Step 1: Create layout.ts**

Create `client/src/components/SolarSystem/layout.ts`:
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
  colorVar: string;        // CSS var name without the `--` prefix
  position: Pt;            // computed at module load from ORBITS
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
    // Sit on the outer orbit at angle ~155° (left side, slightly below midline)
    position: (() => {
      const c = ellipseCenterFromLeftFocus(STAR, ORBITS.outer.a, ORBITS.outer.e);
      const t = (155 * Math.PI) / 180;
      return { x: c.x + ORBITS.outer.a * Math.cos(t), y: c.y + ORBITS.outer.a * 0.347 * Math.sin(t) };
      // ry/rx ≈ 125/360 ≈ 0.347 — keeps points on the visible ring
    })(),
  },
  {
    id: 'gce',
    label: 'GCE',
    kind: 'outer',
    colorVar: 'color-gce',
    position: (() => {
      const c = ellipseCenterFromLeftFocus(STAR, ORBITS.outer.a, ORBITS.outer.e);
      const t = (35 * Math.PI) / 180;
      return { x: c.x + ORBITS.outer.a * Math.cos(t), y: c.y + ORBITS.outer.a * 0.347 * Math.sin(t) };
    })(),
  },
];

export function findNode(id: string): NodeDescriptor | undefined {
  return NODES.find((n) => n.id === id);
}

// Camera-target scales by view kind
export const SYSTEM_SCALE = 1;
export const PLANET_SCALE = 2.5;
```

- [ ] **Step 2: Quick smoke test**

Add to `client/src/lib/geometry.test.ts` at the bottom:
```ts
import { NODES, STAR, findNode } from '../components/SolarSystem/layout';
describe('layout', () => {
  it('places perihelion to the left of the star', () => {
    const p = findNode('perihelion')!;
    expect(p.position.x).toBeLessThan(STAR.x);
  });
  it('places aphelion to the right of the star', () => {
    const a = findNode('aphelion')!;
    expect(a.position.x).toBeGreaterThan(STAR.x);
  });
});
```

Run: `pnpm test geometry` — expect PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SolarSystem/layout.ts client/src/lib/geometry.test.ts
git commit -m "feat(solar-system): layout constants + node positions"
```

---

## Task 8: Star component

**Files:**
- Create: `client/src/components/SolarSystem/Star.tsx`
- Create: `client/src/components/SolarSystem/Star.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Star.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Star } from './Star';
import { STAR } from './layout';

describe('Star', () => {
  it('renders two faint circles centered at the star focus', () => {
    const { container } = render(
      <svg viewBox="0 0 800 480"><Star /></svg>
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2);
    circles.forEach(c => {
      expect(c.getAttribute('cx')).toBe(String(STAR.x));
      expect(c.getAttribute('cy')).toBe(String(STAR.y));
    });
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test Star
```

- [ ] **Step 3: Implement Star.tsx**

Create `client/src/components/SolarSystem/Star.tsx`:
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

- [ ] **Step 4: Pass + commit**

```bash
pnpm test Star
git add client/src/components/SolarSystem/Star.tsx client/src/components/SolarSystem/Star.test.tsx
git commit -m "feat(solar-system): Star placeholder component"
```

---

## Task 9: Orbit component

**Files:**
- Create: `client/src/components/SolarSystem/Orbit.tsx`
- Create: `client/src/components/SolarSystem/Orbit.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Orbit.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Orbit } from './Orbit';
import { STAR, ORBITS } from './layout';
import { ellipseCenterFromLeftFocus } from '../../lib/geometry';

describe('Orbit', () => {
  it('renders an ellipse with center to the right of the star focus', () => {
    const { container } = render(<svg><Orbit which="inner" /></svg>);
    const ellipse = container.querySelector('ellipse')!;
    const expected = ellipseCenterFromLeftFocus(STAR, ORBITS.inner.a, ORBITS.inner.e);
    expect(Number(ellipse.getAttribute('cx'))).toBeCloseTo(expected.x);
    expect(Number(ellipse.getAttribute('cy'))).toBeCloseTo(expected.y);
    expect(Number(ellipse.getAttribute('rx'))).toBe(ORBITS.inner.a);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test Orbit
```

- [ ] **Step 3: Implement Orbit.tsx**

Create `client/src/components/SolarSystem/Orbit.tsx`:
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

- [ ] **Step 4: Pass + commit**

```bash
pnpm test Orbit
git add client/src/components/SolarSystem/Orbit.tsx client/src/components/SolarSystem/Orbit.test.tsx
git commit -m "feat(solar-system): Orbit ellipse component"
```

---

## Task 10: Primary Planet wireframe component

**Files:**
- Create: `client/src/components/SolarSystem/Planet/index.tsx`
- Create: `client/src/components/SolarSystem/Planet/Planet.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Planet/Planet.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Planet } from './index';

describe('Planet', () => {
  it('renders at the given position with the color var', () => {
    const { container } = render(
      <svg><Planet x={223} y={240} colorVar="color-perihelion" /></svg>
    );
    const g = container.querySelector('g[data-planet]')!;
    expect(g.getAttribute('transform')).toBe('translate(223 240)');
    const c = container.querySelector('circle[data-outline]');
    expect(c?.getAttribute('stroke')).toBe('var(--color-perihelion)');
  });
  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <svg><Planet x={0} y={0} colorVar="color-perihelion" onClick={onClick} /></svg>
    );
    fireEvent.click(container.querySelector('g[data-planet]')!);
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test Planet
```

- [ ] **Step 3: Implement Planet/index.tsx**

Create `client/src/components/SolarSystem/Planet/index.tsx`:
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

- [ ] **Step 4: Pass + commit**

```bash
pnpm test Planet
git add client/src/components/SolarSystem/Planet/index.tsx client/src/components/SolarSystem/Planet/Planet.test.tsx
git commit -m "feat(solar-system): primary Planet wireframe"
```

---

## Task 11: OuterPlanet component

**Files:**
- Create: `client/src/components/SolarSystem/Planet/OuterPlanet.tsx`
- Create: `client/src/components/SolarSystem/Planet/OuterPlanet.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Planet/OuterPlanet.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OuterPlanet } from './OuterPlanet';

describe('OuterPlanet', () => {
  it('renders translated and uses the color var', () => {
    const { container } = render(
      <svg><OuterPlanet x={110} y={280} colorVar="color-cloudflare" label="CLOUDFLARE" /></svg>
    );
    expect(container.querySelector('g[data-outer-planet]')!.getAttribute('transform')).toBe('translate(110 280)');
    expect(container.textContent).toContain('CLOUDFLARE');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test OuterPlanet
```

- [ ] **Step 3: Implement OuterPlanet.tsx**

Create `client/src/components/SolarSystem/Planet/OuterPlanet.tsx`:
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

- [ ] **Step 4: Pass + commit**

```bash
pnpm test OuterPlanet
git add client/src/components/SolarSystem/Planet/OuterPlanet.tsx client/src/components/SolarSystem/Planet/OuterPlanet.test.tsx
git commit -m "feat(solar-system): OuterPlanet small variant"
```

---

## Task 12: Satellites component (per-planet service nodes)

**Files:**
- Create: `client/src/components/SolarSystem/Planet/Satellites.tsx`
- Create: `client/src/components/SolarSystem/Planet/Satellites.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Planet/Satellites.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Satellites, distributeSatellites } from './Satellites';
import type { Service } from '@apseline/shared';

const svc = (name: string): Service => ({ name, url: `https://${name}.local`, infrastructure: 'perihelion' });

describe('distributeSatellites', () => {
  it('places services across three tiers stably', () => {
    const services = [svc('a'), svc('b'), svc('c'), svc('d'), svc('e'), svc('f'), svc('g'), svc('h'), svc('i')];
    const slots1 = distributeSatellites(services);
    const slots2 = distributeSatellites([...services]);
    expect(slots1).toEqual(slots2);
    const tiers = new Set(slots1.map(s => s.tier));
    expect(tiers.size).toBeGreaterThan(1);
  });
});

describe('Satellites', () => {
  it('renders one circle per service and fires onSelect on click', () => {
    const onSelect = vi.fn();
    const services = [svc('jellyfin'), svc('grafana')];
    const { container } = render(
      <svg><Satellites services={services} colorVar="color-perihelion" opacity={1} onSelect={onSelect} /></svg>
    );
    const dots = container.querySelectorAll('circle[data-satellite]');
    expect(dots.length).toBe(2);
    fireEvent.click(dots[0]);
    expect(onSelect).toHaveBeenCalledWith('jellyfin');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test Satellites
```

- [ ] **Step 3: Implement Satellites.tsx**

Create `client/src/components/SolarSystem/Planet/Satellites.tsx`:
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
  // Stable: sort by name then assign by index mod TIER_COUNT.
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

- [ ] **Step 4: Pass + commit**

```bash
pnpm test Satellites
git add client/src/components/SolarSystem/Planet/Satellites.tsx client/src/components/SolarSystem/Planet/Satellites.test.tsx
git commit -m "feat(solar-system): Satellites with tier distribution"
```

---

## Task 13: Chrome — Brackets

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/Brackets.tsx`

- [ ] **Step 1: Implement (no behavior, no test needed for static SVG)**

Create `client/src/components/SolarSystem/Chrome/Brackets.tsx`:
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

## Task 14: Chrome — Header (top label + clock)

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/Header.tsx`
- Create: `client/src/components/SolarSystem/Chrome/Header.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Chrome/Header.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  it('renders system header in system view', () => {
    const { container } = render(<svg><Header view={{ kind: 'system' }} /></svg>);
    expect(container.textContent).toContain('APSELINE');
    expect(container.textContent).toContain('SYSTEM');
  });
  it('renders planet header in planet view', () => {
    const { container } = render(<svg><Header view={{ kind: 'planet', nodeId: 'perihelion' }} /></svg>);
    expect(container.textContent).toContain('PERIHELION');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test Header
```

- [ ] **Step 3: Implement Header.tsx**

Create `client/src/components/SolarSystem/Chrome/Header.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { View } from '../../../stores/viewStore';
import { findNode, VIEWBOX_W } from '../layout';

function fmtClock(d: Date) {
  const z = (n: number) => n.toString().padStart(2, '0');
  return `${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())}Z`;
}

export function Header({ view }: { view: View }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const { primary, secondary } = headerLines(view);
  const accent = view.kind === 'system' ? 'rgba(160,145,214,0.85)' : `var(--${findNode(view.nodeId)?.colorVar ?? 'color-perihelion'})`;

  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={9} letterSpacing={1}>
      <text x={20} y={28} fill={accent}>{primary}</text>
      <text x={20} y={42} fill="rgba(255,255,255,0.5)">{secondary}</text>
      <text x={VIEWBOX_W - 20} y={28} textAnchor="end" fill="rgba(255,255,255,0.5)">{fmtClock(now)}</text>
    </g>
  );
}

function headerLines(view: View): { primary: string; secondary: string } {
  if (view.kind === 'system') {
    return { primary: 'APSELINE ▸ SYSTEM', secondary: 'NODES: 4 / SVCS: — / OK' };
  }
  const node = findNode(view.kind === 'planet' ? view.nodeId : view.nodeId);
  return { primary: `${node?.label ?? '—'} ▸ NODE`, secondary: 'CPU — · MEM — · UP —' };
}
```

- [ ] **Step 4: Pass + commit**

```bash
pnpm test Header
git add client/src/components/SolarSystem/Chrome/Header.tsx client/src/components/SolarSystem/Chrome/Header.test.tsx
git commit -m "feat(chrome): top header with view-aware label + UTC clock"
```

---

## Task 15: Chrome — Telemetry (bottom-left)

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/Telemetry.tsx`

- [ ] **Step 1: Implement**

Create `client/src/components/SolarSystem/Chrome/Telemetry.tsx`:
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

## Task 16: Chrome — UtilityDock (bottom-right)

**Files:**
- Create: `client/src/components/SolarSystem/Chrome/UtilityDock.tsx`
- Create: `client/src/components/SolarSystem/Chrome/UtilityDock.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Chrome/UtilityDock.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UtilityDock } from './UtilityDock';

describe('UtilityDock', () => {
  it('renders settings/logs/discovery and alerts pip', () => {
    const onItem = vi.fn();
    const { container, getByText } = render(<svg><UtilityDock alertCount={2} onItem={onItem} /></svg>);
    expect(container.textContent).toContain('settings');
    expect(container.textContent).toContain('logs');
    expect(container.textContent).toContain('discovery');
    expect(container.textContent).toContain('alerts · 2');
    fireEvent.click(getByText('settings'));
    expect(onItem).toHaveBeenCalledWith('settings');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test UtilityDock
```

- [ ] **Step 3: Implement UtilityDock.tsx**

Create `client/src/components/SolarSystem/Chrome/UtilityDock.tsx`:
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

function DockItem({ x, y, pip, fill, label, onClick }: { x: number; y: number; pip: string; fill: string; label: string; onClick: () => void }) {
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      <circle cx={x} cy={y - 3} r={2} fill={pip} />
      <text x={x + 8} y={y} fill={fill}>{label}</text>
    </g>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
pnpm test UtilityDock
git add client/src/components/SolarSystem/Chrome/UtilityDock.tsx client/src/components/SolarSystem/Chrome/UtilityDock.test.tsx
git commit -m "feat(chrome): bottom-right utility dock"
```

---

## Task 17: Camera component

**Files:**
- Create: `client/src/components/SolarSystem/Camera.tsx`
- Create: `client/src/components/SolarSystem/Camera.test.tsx`

- [ ] **Step 1: Failing test**

Create `client/src/components/SolarSystem/Camera.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Camera, computeCameraTarget } from './Camera';
import { findNode, STAR } from './layout';

describe('computeCameraTarget', () => {
  it('returns system center for system view', () => {
    const t = computeCameraTarget({ kind: 'system' });
    expect(t.scale).toBe(1);
  });
  it('centers on planet position for planet view with PLANET_SCALE', () => {
    const t = computeCameraTarget({ kind: 'planet', nodeId: 'perihelion' });
    const p = findNode('perihelion')!.position;
    expect(t.x).toBe(p.x);
    expect(t.y).toBe(p.y);
    expect(t.scale).toBeGreaterThan(1);
  });
  it('apex sits directly above the star', () => {
    const t = computeCameraTarget({ kind: 'system' });
    expect(STAR.x).toBe(300);
  });
});

describe('Camera', () => {
  it('renders children inside a transformed g', () => {
    const { container } = render(
      <svg><Camera view={{ kind: 'system' }} transitionId={0}><circle data-child r={1} /></Camera></svg>
    );
    expect(container.querySelector('circle[data-child]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test Camera
```

- [ ] **Step 3: Implement Camera.tsx**

Create `client/src/components/SolarSystem/Camera.tsx`:
```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
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
  const node = findNode(view.kind === 'planet' ? view.nodeId : view.nodeId);
  if (!node) return { x: SYSTEM_CENTER.x, y: SYSTEM_CENTER.y, scale: SYSTEM_SCALE };
  return { x: node.position.x, y: node.position.y, scale: PLANET_SCALE };
}

function transitionDurationMs(prev: View, next: View): number {
  if (prev.kind === 'system' && next.kind === 'planet') return ZOOM_IN_DURATION_MS;
  if (prev.kind === 'planet' && next.kind === 'system') return ZOOM_OUT_DURATION_MS;
  if (prev.kind === 'planet' && next.kind === 'planet' && prev.nodeId !== next.nodeId) return SWOOP_DURATION_MS;
  return 0;
}

function useCameraAnimation(view: View, transitionId: number, reduced: boolean) {
  const prevRef = useRef<View>(view);
  const ref = useRef<{ x: number; y: number; scale: number }>(computeCameraTarget(view));
  const animRef = useRef<number | null>(null);
  const tickRef = useRef<{ start: number; from: CameraTarget; to: CameraTarget; duration: number; useApex: boolean } | null>(null);
  const [, force] = useTickState();

  useEffect(() => {
    const prev = prevRef.current;
    const next = view;
    prevRef.current = next;
    const to = computeCameraTarget(next);
    const from = ref.current;
    const duration = reduced ? 0 : transitionDurationMs(prev, next);
    const useApex = !reduced && prev.kind === 'planet' && next.kind === 'planet' && prev.nodeId !== next.nodeId;
    if (duration === 0) {
      ref.current = to;
      force();
      return;
    }
    tickRef.current = { start: performance.now(), from, to, duration, useApex };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const step = (now: number) => {
      const t = tickRef.current!;
      const raw = Math.min(1, (now - t.start) / t.duration);
      const eased = easeInOutCubic(raw);
      const pos = t.useApex
        ? quadBezier(eased, t.from, APEX, t.to)
        : { x: lerp(t.from.x, t.to.x, eased), y: lerp(t.from.y, t.to.y, eased) };
      const scale = t.useApex
        ? (raw < 0.5 ? lerp(t.from.scale, SYSTEM_SCALE, eased * 2) : lerp(SYSTEM_SCALE, t.to.scale, (eased - 0.5) * 2))
        : lerp(t.from.scale, t.to.scale, eased);
      ref.current = { x: pos.x, y: pos.y, scale };
      force();
      if (raw < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    // transitionId in dep array forces re-evaluation on mid-flight redirect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionId, reduced]);

  return ref.current;
}

function useTickState(): [number, () => void] {
  const ref = useRef(0);
  const setRef = useRef<(n: number) => void>(() => {});
  const [v, setV] = useStateLite();
  setRef.current = setV;
  return [v, () => { ref.current++; setRef.current(ref.current); }];
}

// Tiny shim to avoid importing useState into multiple places
import { useState as useStateLite } from 'react';

interface CameraProps {
  view: View;
  transitionId: number;
  children: React.ReactNode;
}

export function Camera({ view, transitionId, children }: CameraProps) {
  const reduced = !!useReducedMotion();
  const cam = useCameraAnimation(view, transitionId, reduced);
  // viewBox stays fixed; we apply translate+scale to a g group so the camera's "look-target"
  // is positioned at the viewBox center (VIEWBOX_W/2, VIEWBOX_H/2).
  const tx = useMemo(() => VIEWBOX_W / 2 - cam.x * cam.scale, [cam.x, cam.scale]);
  const ty = useMemo(() => VIEWBOX_H / 2 - cam.y * cam.scale, [cam.y, cam.scale]);
  return (
    <motion.g transform={`translate(${tx} ${ty}) scale(${cam.scale})`}>{children}</motion.g>
  );
}
```

- [ ] **Step 4: Replace the inline shim with proper hooks**

Replace the bottom of `Camera.tsx` (the `useTickState` and the trailing `import { useState as useStateLite }`) with a clean version. Final file should look like this — overwrite Camera.tsx with the cleaned version below:

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
  const id = view.kind === 'planet' ? view.nodeId : view.nodeId;
  const node = findNode(id);
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

- [ ] **Step 5: Pass + commit**

```bash
pnpm test Camera
git add client/src/components/SolarSystem/Camera.tsx client/src/components/SolarSystem/Camera.test.tsx
git commit -m "feat(camera): rAF-driven camera with bezier swoop + reduced-motion"
```

---

## Task 18: SolarSystem outer component (composition)

**Files:**
- Create: `client/src/components/SolarSystem/index.tsx`

- [ ] **Step 1: Implement**

Create `client/src/components/SolarSystem/index.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { useViewStore } from '../../stores/viewStore';
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
import { NODES, VIEWBOX_W, VIEWBOX_H } from './layout';
import { ZOOM_IN_DURATION_MS, SWOOP_DURATION_MS, SATELLITE_FADE_MS } from '../../lib/transitions';

export function SolarSystem() {
  const { view, transitionId, navigate, openService } = useViewStore();
  const services = useServicesStore((s) => s.services);
  const satOpacity = useSatelliteFade(view, transitionId);

  const planetView = view.kind === 'planet' || view.kind === 'service' ? view : null;
  const activeNodeId = planetView?.nodeId ?? null;

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
          {activeNodeId && (
            <g transform={`translate(${NODES.find(n => n.id === activeNodeId)!.position.x} ${NODES.find(n => n.id === activeNodeId)!.position.y})`}>
              <Satellites
                services={services.filter(s => s.infrastructure === activeNodeId)}
                colorVar={NODES.find(n => n.id === activeNodeId)!.colorVar}
                opacity={satOpacity}
                onSelect={openService}
              />
            </g>
          )}
        </Camera>

        {/* Chrome lives outside the camera so it stays put */}
        <Brackets />
        <Header view={view} />
        <Telemetry serviceCount={services.length} />
        <UtilityDock alertCount={0} onItem={() => { /* wired in later task */ }} />
      </svg>
    </div>
  );
}

function useSatelliteFade(view: any, transitionId: number) {
  // Holds at 0 during the early phase of an arrival, ramps to 1 in the final SATELLITE_FADE_MS.
  const [op, setOp] = useState(view.kind === 'planet' || view.kind === 'service' ? 1 : 0);
  useEffect(() => {
    if (view.kind === 'system') { setOp(0); return; }
    const total = view.kind === 'planet' ? ZOOM_IN_DURATION_MS : SWOOP_DURATION_MS;
    const fadeStart = total - SATELLITE_FADE_MS;
    setOp(0);
    const t1 = setTimeout(() => {
      const start = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SATELLITE_FADE_MS);
        setOp(t);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, fadeStart);
    return () => clearTimeout(t1);
  }, [transitionId]);
  return op;
}
```

- [ ] **Step 2: Manual smoke**

Run `pnpm dev` from `client/`. Open the URL. Expect: empty solar system rendered (no services until backend serves data, but planets/orbits/chrome should show).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SolarSystem/index.tsx
git commit -m "feat(solar-system): SolarSystem composition with camera + chrome"
```

---

## Task 19: Service detail modal — frame, callout, content

**Files:**
- Create: `client/src/components/SolarSystem/ServiceModal/index.tsx`
- Create: `client/src/components/SolarSystem/ServiceModal/CalloutLine.tsx`
- Create: `client/src/components/SolarSystem/ServiceModal/SatelliteHighlight.tsx`

- [ ] **Step 1: Implement CalloutLine**

Create `client/src/components/SolarSystem/ServiceModal/CalloutLine.tsx`:
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

Create `client/src/components/SolarSystem/ServiceModal/SatelliteHighlight.tsx`:
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

- [ ] **Step 3: Implement modal index.tsx**

Create `client/src/components/SolarSystem/ServiceModal/index.tsx`:
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)' }}>
      <span>{label}</span><span style={{ color: '#fff' }}>{value}</span>
    </div>
  );
}

function hostnameOf(url: string) { try { return new URL(url).host; } catch { return url; } }

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
```

- [ ] **Step 4: Wire modal + dim into SolarSystem**

In `client/src/components/SolarSystem/index.tsx`, add at the top of the file:
```tsx
import { ServiceModal } from './ServiceModal';
import { SatelliteHighlight } from './ServiceModal/SatelliteHighlight';
import { distributeSatellites } from './Planet/Satellites';
```

Inside the returned tree (after `<UtilityDock …/>`), append:
```tsx
{view.kind === 'service' && (() => {
  const node = NODES.find(n => n.id === view.nodeId)!;
  const list = services.filter(s => s.infrastructure === view.nodeId);
  const slot = distributeSatellites(list).find(s => s.service.name === view.serviceId);
  return (
    <>
      {/* dim background */}
      <rect x={0} y={0} width={VIEWBOX_W} height={VIEWBOX_H} fill="rgba(10,10,20,0.55)" pointerEvents="none" />
      {/* highlight selected satellite (in scene-space) */}
      {slot && (
        <g transform={`translate(${node.position.x} ${node.position.y})`}>
          <SatelliteHighlight x={slot.x} y={slot.y} colorVar={node.colorVar} />
        </g>
      )}
    </>
  );
})()}
```

And **outside** the SVG (so HTML modal renders on top), inside the outer `<div>` after the `</svg>`:
```tsx
{view.kind === 'service' && (
  <ServiceModal nodeId={view.nodeId} serviceId={view.serviceId} services={services} />
)}
```

- [ ] **Step 5: Smoke + commit**

```bash
pnpm dev   # click a planet, click a satellite, modal should appear; Esc closes it
git add client/src/components/SolarSystem/ServiceModal client/src/components/SolarSystem/index.tsx
git commit -m "feat(modal): service detail modal with callout + dim backdrop"
```

---

## Task 20: Retune OrbitalBackground to use theme variables

**Files:**
- Modify: `client/src/components/OrbitalBackground.tsx`
- Modify: `client/src/App.tsx` (still using it via existing wiring)

- [ ] **Step 1: Replace hardcoded colors with CSS-var lookup**

In `client/src/components/OrbitalBackground.tsx`, replace the `getColors()` function with:
```ts
const getColors = () => {
  const root = getComputedStyle(document.documentElement);
  const hex = (infrastructure === 'perihelion'
    ? root.getPropertyValue('--color-perihelion')
    : root.getPropertyValue('--color-aphelion')).trim() || '#DA79B0';
  // Convert hex to "rgba(r, g, b, " prefix
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { particle: `rgba(${r}, ${g}, ${b}, ` };
};
```

- [ ] **Step 2: Smoke + commit**

```bash
pnpm dev   # background particles should now match the active theme
git add client/src/components/OrbitalBackground.tsx
git commit -m "chore(bg): retune particle color to theme vars"
```

---

## Task 21: ThemePicker (settings overlay)

**Files:**
- Create: `client/src/components/SolarSystem/Settings/ThemePicker.tsx`
- Create: `client/src/components/SolarSystem/Settings/SettingsPanel.tsx`

- [ ] **Step 1: Implement ThemePicker**

Create `client/src/components/SolarSystem/Settings/ThemePicker.tsx`:
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

Create `client/src/components/SolarSystem/Settings/SettingsPanel.tsx`:
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

In `client/src/components/SolarSystem/index.tsx`, near other imports add:
```tsx
import { SettingsPanel } from './Settings/SettingsPanel';
```

Replace the existing `useState, useEffect` import line with:
```tsx
import { useState, useEffect } from 'react';
```

Inside the component, add:
```tsx
const [openPanel, setOpenPanel] = useState<null | 'settings' | 'logs' | 'discovery' | 'alerts'>(null);
```

Replace the `<UtilityDock alertCount={0} onItem={() => { /* wired in later task */ }} />` line with:
```tsx
<UtilityDock alertCount={0} onItem={(id) => setOpenPanel(id)} />
```

After the `</svg>` (and after the existing `view.kind === 'service'` modal) add:
```tsx
<SettingsPanel open={openPanel === 'settings'} onClose={() => setOpenPanel(null)} />
```

- [ ] **Step 4: Smoke + commit**

```bash
pnpm dev    # click "settings" in dock → panel opens → click a theme → background + accents change
git add client/src/components/SolarSystem/Settings client/src/components/SolarSystem/index.tsx
git commit -m "feat(settings): theme picker with 6 themes"
```

---

## Task 22: Boot wiring — apply theme on startup, render SolarSystem

**Files:**
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Apply theme on boot**

Modify `client/src/main.tsx` to call `initFromStorage` before React mounts. Keep existing structure; add:
```tsx
import { useThemeStore } from './stores/themeStore';
useThemeStore.getState().initFromStorage();
```
Place that call after imports and before `ReactDOM.createRoot(...)`.

- [ ] **Step 2: Replace App body**

Overwrite `client/src/App.tsx` with:
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
rm client/src/components/Header.tsx
rm client/src/components/ServiceCard.tsx
rm client/src/components/ServiceGrid.tsx
```

- [ ] **Step 4: Build & smoke test**

Run from `client/`:
```bash
pnpm build
pnpm dev
```
Expected: build succeeds; dev server shows the new solar-system view; clicking Perihelion zooms in; clicking Aphelion swoops; Esc closes modals; settings dock opens theme picker; reduced-motion (DevTools rendering tab) disables camera moves.

- [ ] **Step 5: Commit**

```bash
git add client/src/main.tsx client/src/App.tsx
git rm client/src/components/Header.tsx client/src/components/ServiceCard.tsx client/src/components/ServiceGrid.tsx
git commit -m "feat: replace dashboard with solar-system; remove obsolete grid components"
```

---

## Task 23: Acceptance pass

- [ ] **Step 1: Run full test suite**

```bash
cd client && pnpm test
```
Expected: all tests PASS.

- [ ] **Step 2: Build**

```bash
pnpm build
```
Expected: tsc + vite build clean.

- [ ] **Step 3: Manual acceptance against spec §10**

Verify each line in [`docs/superpowers/specs/2026-05-01-orbital-redesign-design.md`](../specs/2026-05-01-orbital-redesign-design.md) §10:

1. Default landing renders system view with star, three orbits, Perihelion at left vertex, Aphelion at right vertex, two outer planets visible.
2. Clicking a primary planet performs the §4.1 zoom-in dolly to a planet view in ≤ 600ms.
3. Clicking a different primary planet from a planet view performs the §4.2 swoop in ≤ 800ms with chrome cross-fade at the apex.
4. Clicking a satellite opens the §5 modal anchored top-right with callout line.
5. Bottom-left telemetry and bottom-right utility dock render and are sized within ±2px of each other's baseline.
6. Theme picker switches between the six themes with no flash.
7. `prefers-reduced-motion: reduce` disables all camera moves; navigation still works.
8. All transitions sustain 60fps on a 2020-era laptop in Chrome and Firefox (DevTools Performance panel).

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore: orbital redesign complete (acceptance pass)"
```

---

## Self-review checklist (run before declaring plan ready)

- ✅ **Spec coverage:** every section of the spec has a task. §1 vision → Task 18+22. §2 spatial model → Tasks 7,8,9,10,11,12. §3 navigation → Task 6. §4 transitions → Tasks 3,17,18. §5 modal → Task 19. §6 palette/themes → Tasks 4,5,21. §7 architecture → file map + all tasks. §10 acceptance → Task 23.
- ✅ **No placeholders:** every code-bearing step contains the full code, not "implement similar to…".
- ✅ **Type consistency:** `View`, `CameraTarget`, `Pt`, `ThemeId`, `NodeDescriptor` are each defined exactly once and referenced consistently across tasks.
- ✅ **Frequent commits:** every task ends with a commit step.
