import { VIEWBOX_H } from '../layout';

interface TelemetryProps {
  netUp?: string;
  netDown?: string;
  diskUsed?: string;
  diskTotal?: string;
  serviceCount?: number;
}

export function Telemetry({
  netUp = '— Mbps',
  netDown = '— Mbps',
  diskUsed = '—',
  diskTotal = '—',
  serviceCount = 0,
}: TelemetryProps) {
  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={8} letterSpacing={0.5} fill="rgba(255,255,255,0.4)">
      <text x={20} y={VIEWBOX_H - 32}>{`NET ↑ ${netUp}  ↓ ${netDown}`}</text>
      <text x={20} y={VIEWBOX_H - 18}>{`DISK ${diskUsed} / ${diskTotal} · ${serviceCount} svcs`}</text>
    </g>
  );
}
