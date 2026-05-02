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
