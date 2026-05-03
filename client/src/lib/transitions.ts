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

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t: number): number {
  return t * t * t;
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

export const SWOOP_DURATION_MS = 2667;
export const SWOOP_APEX_MS = 1333;
export const ZOOM_IN_DURATION_MS = 2400;
export const ZOOM_OUT_DURATION_MS = 2000;
export const SATELLITE_FADE_MS = 800;
