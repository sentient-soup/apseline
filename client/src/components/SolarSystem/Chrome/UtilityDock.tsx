import { VIEWBOX_W, VIEWBOX_H } from '../layout';

export type UtilityItemId = 'settings' | 'logs' | 'discovery' | 'alerts';

interface DockProps {
  alertCount?: number;
  onItem: (id: UtilityItemId) => void;
}

const ROW_Y = VIEWBOX_H - 19;
const CHAR_W = 4.8;   // approximate px per character at fontSize=8 monospace
const PIP_LEAD = 10;  // pip circle (r=2) + gap to text start
const ITEM_GAP = 16;  // gap between end of one item and start of the next
const RIGHT_MARGIN = 18;

// Pack items right-to-left so each item's width is driven by its label length.
function packRight(labels: string[]): number[] {
  const xs = new Array<number>(labels.length);
  let cursor = VIEWBOX_W - RIGHT_MARGIN;
  for (let i = labels.length - 1; i >= 0; i--) {
    cursor -= PIP_LEAD + labels[i].length * CHAR_W;
    xs[i] = cursor;
    if (i > 0) cursor -= ITEM_GAP;
  }
  return xs;
}

function DockItem({ x, pip, fill, label, onClick }: { x: number; pip: string; fill: string; label: string; onClick: () => void }) {
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      <circle cx={x} cy={ROW_Y - 3} r={2} fill={pip} />
      <text x={x + 8} y={ROW_Y} fill={fill}>{label}</text>
    </g>
  );
}

export function UtilityDock({ alertCount = 0, onItem }: DockProps) {
  const gray = 'rgba(255,255,255,0.5)';
  const grayPip = 'rgba(255,255,255,0.35)';
  const alertsLabel = alertCount > 0 ? `alerts (${alertCount})` : 'alerts';
  const [x0, x1, x2, x3] = packRight(['settings', 'logs', 'discovery', alertsLabel]);
  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={8} letterSpacing={0.5}>
      <DockItem x={x0} pip={grayPip}                   fill={gray}                    label="settings"   onClick={() => onItem('settings')} />
      <DockItem x={x1} pip="var(--color-cloudflare)"   fill="var(--color-cloudflare)" label="logs"       onClick={() => onItem('logs')} />
      <DockItem x={x2} pip="var(--color-gce)"          fill="var(--color-gce)"        label="discovery"  onClick={() => onItem('discovery')} />
      <DockItem x={x3} pip="var(--color-alerts)"       fill="var(--color-alerts)"     label={alertsLabel} onClick={() => onItem('alerts')} />
    </g>
  );
}
