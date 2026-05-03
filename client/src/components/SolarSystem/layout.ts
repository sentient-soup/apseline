import type { Pt } from '../../lib/geometry';
import { vertexAt, ellipseCenterFromLeftFocus } from '../../lib/geometry';

export const VIEWBOX_W = 800;
export const VIEWBOX_H = 480;
export const STAR: Pt = { x: 250, y: 240 };
export const STAR_VISUAL: Pt = { x: 340, y: 240 };

export const ORBITS = {
  inner:  { a: 140, e: 0.45, focusDx: 50 },
  middle: { a: 240, e: 0.50, focusDx: 20 },
  outer:  { a: 360, e: 0.40, focusDx: 0 },
  outer2: { a: 400, e: 0.42, focusDx: 0 },
} as const;

export function orbitFocus(which: OrbitKey): Pt {
  return { x: STAR.x + ORBITS[which].focusDx, y: STAR.y };
}

export type OrbitKey = keyof typeof ORBITS;

export interface NodeDescriptor {
  id: string;
  label: string;
  sublabel: string;
  kind: 'primary' | 'outer';
  colorVar: string;
  position: Pt;
}

const RY_RATIO = 0.347;

function pointOnOrbit(a: number, e: number, angleDeg: number): Pt {
  const c = ellipseCenterFromLeftFocus(STAR, a, e);
  const t = (angleDeg * Math.PI) / 180;
  return { x: c.x + a * Math.cos(t), y: c.y + a * RY_RATIO * Math.sin(t) };
}

export const NODES: NodeDescriptor[] = [
  {
    id: 'perihelion',
    label: 'PΞRIH∃LI◯Π',
    sublabel: '░ NODE ░',
    kind: 'primary',
    colorVar: 'color-perihelion',
    position: vertexAt(orbitFocus('inner'), ORBITS.inner.a, ORBITS.inner.e, 'perihelion'),
  },
  {
    id: 'aphelion',
    label: 'APHΞLI◯Π',
    sublabel: '░ NODE ░',
    kind: 'primary',
    colorVar: 'color-aphelion',
    position: vertexAt(orbitFocus('middle'), ORBITS.middle.a, ORBITS.middle.e, 'aphelion'),
  },
  {
    id: 'cloudflare',
    label: 'CLΩ∪DFLARΞ',
    sublabel: '░ EDGE ░',
    kind: 'outer',
    colorVar: 'color-cloudflare',
    position: pointOnOrbit(ORBITS.outer.a, ORBITS.outer.e, -130),
  },
  {
    id: 'gce',
    label: 'GCΞ',
    sublabel: '░ EDGE ░',
    kind: 'outer',
    colorVar: 'color-gce',
    position: pointOnOrbit(ORBITS.outer2.a, ORBITS.outer2.e, 35),
  },
];

export function findNode(id: string): NodeDescriptor | undefined {
  return NODES.find((n) => n.id === id);
}

export const SYSTEM_SCALE = 1;
export const PLANET_SCALE = 34;
