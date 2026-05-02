import { VIEWBOX_W, VIEWBOX_H } from '../layout';

const STROKE = 'rgba(255,255,255,0.22)';
const W = 0.6;

export function Brackets() {
  return (
    <g aria-hidden stroke={STROKE} strokeWidth={W} fill="none">
      <path d={`M 12 12 L 12 32 M 12 12 L 32 12`} />
      <path d={`M ${VIEWBOX_W - 12} 12 L ${VIEWBOX_W - 12} 32 M ${VIEWBOX_W - 12} 12 L ${VIEWBOX_W - 32} 12`} />
      <path d={`M 12 ${VIEWBOX_H - 12} L 12 ${VIEWBOX_H - 32} M 12 ${VIEWBOX_H - 12} L 32 ${VIEWBOX_H - 12}`} />
      <path d={`M ${VIEWBOX_W - 12} ${VIEWBOX_H - 12} L ${VIEWBOX_W - 12} ${VIEWBOX_H - 32} M ${VIEWBOX_W - 12} ${VIEWBOX_H - 12} L ${VIEWBOX_W - 32} ${VIEWBOX_H - 12}`} />
    </g>
  );
}
