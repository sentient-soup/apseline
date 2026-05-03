import { useEffect, useRef } from 'react';
import type { View } from '../../stores/viewStore';
import { findNode, VIEWBOX_W, VIEWBOX_H, PLANET_SCALE, SYSTEM_SCALE } from './layout';
import {
  quadBezier, easeInOutCubic, easeOutCubic, easeInCubic, lerp,
  SWOOP_DURATION_MS, ZOOM_IN_DURATION_MS, ZOOM_OUT_DURATION_MS,
} from '../../lib/transitions';
import type { Pt } from '../../lib/geometry';

export interface CameraTarget { x: number; y: number; scale: number }

const SYSTEM_CENTER: Pt = { x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 };

// Apex sits midway between start and end, lifted upward by an amount
// proportional to the horizontal distance between them.  Short hops get
// a low arc; long hops get a tall one.
const APEX_LIFT_RATIO = 0.55;
const APEX_LIFT_MIN = 80;
function apexBetween(from: Pt, to: Pt): Pt {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.max(APEX_LIFT_MIN, dist * APEX_LIFT_RATIO);
  return { x: midX, y: midY - lift };
}

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

function transformStringFor(cam: CameraTarget): string {
  const tx = VIEWBOX_W / 2 - cam.x * cam.scale;
  const ty = VIEWBOX_H / 2 - cam.y * cam.scale;
  return `translate(${tx} ${ty}) scale(${cam.scale})`;
}

interface CameraProps {
  view: View;
  transitionId: number;
  children: React.ReactNode;
}

export function Camera({ view, transitionId, children }: CameraProps) {
  const groupRef = useRef<SVGGElement | null>(null);
  const camRef = useRef<CameraTarget>(computeCameraTarget(view));
  const prevViewRef = useRef<View>(view);
  const lastIdRef = useRef<number>(-1);
  const rafRef = useRef<number>(0);

  const writeTransform = (cam: CameraTarget) => {
    if (groupRef.current) {
      groupRef.current.setAttribute('transform', transformStringFor(cam));
    }
  };

  useEffect(() => {
    if (lastIdRef.current === transitionId) return;
    lastIdRef.current = transitionId;

    const prev = prevViewRef.current;
    const next = view;
    prevViewRef.current = next;
    const to = computeCameraTarget(next);
    const from = camRef.current;
    const duration = durationFor(prev, next);
    const useApex =
      prev.kind === 'planet' && next.kind === 'planet' && prev.nodeId !== next.nodeId;
    const isOutbound = prev.kind === 'planet' && next.kind === 'system';

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (duration === 0) {
      camRef.current = to;
      writeTransform(to);
      return;
    }

    const apex = useApex ? apexBetween(from, to) : SYSTEM_CENTER;
    const start = performance.now();
    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      const easedSym = easeInOutCubic(raw);
      // System -> planet: pan eases out (centers early), zoom eases in
      // (lands the push-in late). Planet -> system: mirror — pan eases in
      // (lingers near the planet, then drifts), zoom eases out (pulls back
      // first so the system is in frame quickly). Apex swoop stays symmetric.
      const easedPan = useApex ? easedSym : (isOutbound ? easeInCubic(raw) : easeOutCubic(raw));
      const easedZoom = useApex ? easedSym : (isOutbound ? easeOutCubic(raw) : easeInCubic(raw));
      const pos = useApex
        ? quadBezier(easedSym, from, apex, to)
        : { x: lerp(from.x, to.x, easedPan), y: lerp(from.y, to.y, easedPan) };
      // Swoop pulls scale way back at the midpoint via a sine dip so both
      // planets and the flight path are legible during the arc.
      const SWOOP_DIP = 0.94;
      const dipFactor = useApex ? (1 - SWOOP_DIP * Math.sin(Math.PI * raw)) : 1;
      const scale = lerp(from.scale, to.scale, easedZoom) * dipFactor;
      const cam = { x: pos.x, y: pos.y, scale };
      camRef.current = cam;
      writeTransform(cam);
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [transitionId, view]);

  return (
    <g ref={groupRef} transform={transformStringFor(camRef.current)}>
      {children}
    </g>
  );
}
