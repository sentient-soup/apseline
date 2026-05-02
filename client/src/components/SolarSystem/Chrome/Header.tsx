import { useEffect, useState } from 'react';
import { useViewStore, type View } from '../../../stores/viewStore';
import { findNode, NODES, VIEWBOX_W } from '../layout';

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
  const navigate = useViewStore((s) => s.navigate);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Outside-click to close. Defer attachment so the opening click doesn't immediately close.
  useEffect(() => {
    if (!open) return;
    let cleanup: (() => void) | null = null;
    const t = setTimeout(() => {
      const onClick = () => setOpen(false);
      document.addEventListener('click', onClick);
      cleanup = () => document.removeEventListener('click', onClick);
    }, 0);
    return () => {
      clearTimeout(t);
      cleanup?.();
    };
  }, [open]);

  const { primary, secondary } = headerLines(view);
  const isOnPlanet = view.kind === 'planet' || view.kind === 'service';
  const accentVar = isOnPlanet ? findNode(view.nodeId)?.colorVar ?? 'color-perihelion' : null;
  const accent = accentVar ? `var(--${accentVar})` : 'rgba(160,145,214,0.85)';

  // Dropdown contents: SYSTEM (if on a planet) plus other planets (if on a planet, exclude current).
  const currentId = isOnPlanet ? view.nodeId : null;
  const dropdownEntries: { label: string; onSelect: () => void; color: string }[] = [];
  if (isOnPlanet) {
    dropdownEntries.push({
      label: 'APSELINE ▸ SYSTEM',
      color: 'rgba(160,145,214,0.85)',
      onSelect: () => navigate({ kind: 'system' }),
    });
  }
  NODES.filter((n) => n.id !== currentId).forEach((n) => {
    dropdownEntries.push({
      label: `${n.label} ▸ NODE`,
      color: `var(--${n.colorVar})`,
      onSelect: () => navigate({ kind: 'planet', nodeId: n.id }),
    });
  });

  const titleStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };

  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={9} letterSpacing={1}>
      <text
        x={20}
        y={28}
        fill={accent}
        style={titleStyle}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {primary}
      </text>
      <text x={20} y={42} fill="rgba(255,255,255,0.5)">{secondary}</text>
      <text x={VIEWBOX_W - 20} y={28} textAnchor="end" fill="rgba(255,255,255,0.5)">
        {fmtClock(now)}
      </text>

      {open && dropdownEntries.map((entry, i) => (
        <text
          key={entry.label}
          x={20}
          y={62 + i * 14}
          fill={entry.color}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
            entry.onSelect();
          }}
        >
          {entry.label}
        </text>
      ))}
    </g>
  );
}
