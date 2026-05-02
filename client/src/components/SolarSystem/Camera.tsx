import { useEffect, useRef } from 'react';
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

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (duration === 0) {
      camRef.current = to;
      writeTransform(to);
      return;
    }

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
