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

const RY_RATIO = 0.347;

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
