import { STAR } from './layout';

export function Star() {
  return (
    <g aria-hidden>
      <circle cx={STAR.x} cy={STAR.y} r={6}  fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={0.6} />
      <circle cx={STAR.x} cy={STAR.y} r={14} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={0.4} />
    </g>
  );
}
