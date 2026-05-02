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
