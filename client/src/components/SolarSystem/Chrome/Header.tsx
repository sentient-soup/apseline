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
