import { STAR, ORBITS, type OrbitKey } from './layout';
import { ellipseCenterFromLeftFocus } from '../../lib/geometry';

const RY_RATIO = 0.347;

export function Orbit({ which }: { which: OrbitKey }) {
  const { a, e } = ORBITS[which];
  const c = ellipseCenterFromLeftFocus(STAR, a, e);
  const opacity = which === 'inner' ? 0.08 : which === 'middle' ? 0.06 : 0.05;
  return (
    <ellipse
      cx={c.x} cy={c.y} rx={a} ry={a * RY_RATIO}
      fill="none"
      stroke={`rgba(255,255,255,${opacity})`}
      strokeWidth={0.5}
    />
  );
}
