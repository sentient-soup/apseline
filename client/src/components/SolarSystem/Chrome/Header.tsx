import { useEffect, useState } from 'react';
import { useViewStore, type View } from '../../../stores/viewStore';
import { useServicesStore } from '../../../stores/servicesStore';
import { findNode, NODES, VIEWBOX_W } from '../layout';
import type { AllMetrics, HealthMap } from '@apseline/shared';
import { fmtPct, fmtUptime } from '../../../lib/format';

function fmtClock(d: Date) {
  const z = (n: number) => n.toString().padStart(2, '0');
  return `${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())}Z`;
}

function healthStatusLabel(health: HealthMap, total: number): string {
  if (total === 0) return '—';
  const states = Object.values(health);
  if (states.length === 0) return 'PROBING';
  const down = states.filter((h) => h.state === 'down').length;
  const degraded = states.filter((h) => h.state === 'degraded').length;
  if (down > 0) return `${down} DOWN`;
  if (degraded > 0) return `${degraded} DEGRADED`;
  return 'OK';
}

function headerLines(view: View, metrics: AllMetrics | null, svcCount: number, health: HealthMap): { primary: string; secondary: string } {
  if (view.kind === 'system') {
    const totalUp = (metrics?.perihelion?.aggregate.machinesUp ?? 0) + (metrics?.aphelion?.aggregate.machinesUp ?? 0);
    const totalNodes = (metrics?.perihelion?.aggregate.machinesTotal ?? 0) + (metrics?.aphelion?.aggregate.machinesTotal ?? 0);
    const nodes = totalNodes > 0 ? `${totalUp}/${totalNodes}` : `${NODES.length}`;
    return {
      primary: 'APSΞLIΠΞ ▸ SYSTEM',
      secondary: `NODES ${nodes} · SVCS ${svcCount} · ${healthStatusLabel(health, svcCount)}`,
    };
  }

  const node = findNode(view.nodeId);
  const nodeTag = node?.kind === 'outer' ? 'EDGE' : 'NODE';
  const planet = view.nodeId === 'perihelion' ? metrics?.perihelion
               : view.nodeId === 'aphelion'   ? metrics?.aphelion
               : undefined;

  if (!planet) {
    return { primary: `${node?.label ?? '—'} ▸ ${nodeTag}`, secondary: 'CPU — · MEM — · UP —' };
  }

  // Pick the longest-running machine on this planet for "UP" — most representative.
  const longestUp = planet.machines
    .map((m) => m.uptimeSeconds)
    .filter((s): s is number => typeof s === 'number')
    .reduce((a, b) => (a !== undefined && a > b ? a : b), undefined as number | undefined);

  return {
    primary: `${node?.label ?? '—'} ▸ ${nodeTag}`,
    secondary: `CPU ${fmtPct(planet.aggregate.cpuPct)} · MEM ${fmtPct(planet.aggregate.memPct)} · UP ${fmtUptime(longestUp)}`,
  };
}

export function Header({ view }: { view: View }) {
  const navigate = useViewStore((s) => s.navigate);
  const metrics = useServicesStore((s) => s.metrics);
  const services = useServicesStore((s) => s.services);
  const health = useServicesStore((s) => s.health);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

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

  const { primary, secondary } = headerLines(view, metrics, services.length, health);
  const isOnPlanet = view.kind === 'planet' || view.kind === 'service';
  const accentVar = isOnPlanet ? findNode(view.nodeId)?.colorVar ?? 'color-perihelion' : null;
  const accent = accentVar ? `var(--${accentVar})` : 'var(--color-star)';

  const currentId = isOnPlanet ? view.nodeId : null;
  const dropdownEntries: { label: string; onSelect: () => void; color: string }[] = [];
  if (isOnPlanet) {
    dropdownEntries.push({
      label: 'APSΞLIΠΞ ▸ SYSTEM',
      color: 'var(--color-star)',
      onSelect: () => navigate({ kind: 'system' }),
    });
  }
  NODES.filter((n) => n.id !== currentId).forEach((n) => {
    dropdownEntries.push({
      label: `${n.label} ▸ ${n.kind === 'outer' ? 'EDGE' : 'NODE'}`,
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
