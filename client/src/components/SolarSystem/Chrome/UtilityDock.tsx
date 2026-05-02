import { VIEWBOX_W, VIEWBOX_H } from '../layout';

export type UtilityItemId = 'settings' | 'logs' | 'discovery' | 'alerts';

interface DockProps {
  alertCount?: number;
  onItem: (id: UtilityItemId) => void;
}

const ROW_Y_TOP = VIEWBOX_H - 35;
const ROW_Y_BOT = VIEWBOX_H - 19;
const COLS = [VIEWBOX_W - 200, VIEWBOX_W - 140, VIEWBOX_W - 97];

function DockItem({ x, y, pip, fill, label, onClick }: { x: number; y: number; pip: string; fill: string; label: string; onClick: () => void }) {
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      <circle cx={x} cy={y - 3} r={2} fill={pip} />
      <text x={x + 8} y={y} fill={fill}>{label}</text>
    </g>
  );
}

export function UtilityDock({ alertCount = 0, onItem }: DockProps) {
  const dim = 'rgba(255,255,255,0.5)';
  const dimPip = 'rgba(255,255,255,0.35)';
  return (
    <g fontFamily="ui-monospace, Menlo, monospace" fontSize={8} letterSpacing={0.5}>
      <DockItem x={COLS[0]} y={ROW_Y_TOP} pip={dimPip} fill={dim} label="settings" onClick={() => onItem('settings')} />
      <DockItem x={COLS[1]} y={ROW_Y_TOP} pip={dimPip} fill={dim} label="logs"     onClick={() => onItem('logs')} />
      <DockItem x={COLS[2]} y={ROW_Y_TOP} pip={dimPip} fill={dim} label="discovery" onClick={() => onItem('discovery')} />
      <DockItem x={COLS[0]} y={ROW_Y_BOT} pip="var(--color-alerts)" fill="var(--color-alerts)" label={`alerts · ${alertCount}`} onClick={() => onItem('alerts')} />
    </g>
  );
}
