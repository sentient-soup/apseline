import type { AllMetrics, PlanetMetrics } from '@apseline/shared';
import { useServicesStore } from '../../../stores/servicesStore';
import { useViewStore } from '../../../stores/viewStore';
import { VIEWBOX_H } from '../layout';
import { fmtBitsPerSec, fmtPct } from '../../../lib/format';

interface AggregateView {
  netRxBps?: number;
  netTxBps?: number;
  diskPct?: number;
  cpuPct?: number;
}

function aggregateForView(view: ReturnType<typeof useViewStore.getState>['view'], m: AllMetrics | null): AggregateView {
  if (!m) return {};
  // System view → roll perihelion + aphelion together.
  if (view.kind === 'system') {
    const planets = [m.perihelion, m.aphelion].filter((p): p is PlanetMetrics => !!p);
    const sumNum = (vals: (number | undefined)[]) => {
      const xs = vals.filter((v): v is number => typeof v === 'number');
      return xs.length ? xs.reduce((a, b) => a + b, 0) : undefined;
    };
    const avgNum = (vals: (number | undefined)[]) => {
      const xs = vals.filter((v): v is number => typeof v === 'number');
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
    };
    return {
      netRxBps: sumNum(planets.map((p) => p.aggregate.netRxBps)),
      netTxBps: sumNum(planets.map((p) => p.aggregate.netTxBps)),
      diskPct: avgNum(planets.map((p) => p.aggregate.diskPct)),
      cpuPct: avgNum(planets.map((p) => p.aggregate.cpuPct)),
    };
  }
  // Planet view → that planet's aggregate (only valid for perihelion/aphelion;
  // outer planets like cloudflare don't have VM telemetry yet).
  const planet = view.nodeId === 'perihelion' ? m.perihelion
               : view.nodeId === 'aphelion'   ? m.aphelion
               : undefined;
  if (!planet) return {};
  return {
    netRxBps: planet.aggregate.netRxBps,
    netTxBps: planet.aggregate.netTxBps,
    diskPct: planet.aggregate.diskPct,
    cpuPct: planet.aggregate.cpuPct,
  };
}

export function Telemetry() {
  const view = useViewStore((s) => s.view);
  const services = useServicesStore((s) => s.services);
  const metrics = useServicesStore((s) => s.metrics);
  const a = aggregateForView(view, metrics);

  const line1 = `NET ↑ ${fmtBitsPerSec(a.netTxBps)}  ↓ ${fmtBitsPerSec(a.netRxBps)}`;
  const line2 = `CPU ${fmtPct(a.cpuPct)}  ·  DISK ${fmtPct(a.diskPct)}  ·  ${services.length} svcs`;

  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={8} letterSpacing={0.5} fill="rgba(255,255,255,0.4)">
      <text x={20} y={VIEWBOX_H - 32}>{line1}</text>
      <text x={20} y={VIEWBOX_H - 18}>{line2}</text>
    </g>
  );
}
