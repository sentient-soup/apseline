import { STAR_VISUAL as STAR } from './layout';

const RADIUS = 8;
const STROKE = 'var(--color-star)';

export function Star() {
  const lats = [-2, -1, 0, 1, 2].map((i) => {
    const a = (i / 3) * (Math.PI / 2);
    const cy = Math.sin(a) * RADIUS;
    const ry = Math.cos(a) * RADIUS * 0.18;
    const rx = Math.cos(a) * RADIUS;
    return { cy, rx, ry };
  });
  const longs = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI;
    const rx = Math.abs(Math.cos(a)) * RADIUS;
    return { rx };
  });

  return (
    <g aria-hidden>
      <g transform={`translate(${STAR.x} ${STAR.y})`}>
        <circle r={RADIUS} fill="none" stroke={STROKE} strokeWidth={0.5} />
        {lats.map((l, i) => (
          <ellipse key={`s-lat-${i}`} cy={l.cy} rx={l.rx} ry={l.ry} fill="none" stroke={STROKE} strokeOpacity={0.6} strokeWidth={0.3} />
        ))}
        {longs.map((l, i) => (
          <ellipse key={`s-lon-${i}`} rx={l.rx} ry={RADIUS} fill="none" stroke={STROKE} strokeOpacity={0.6} strokeWidth={0.3} />
        ))}
      </g>
      <text
        x={STAR.x}
        y={STAR.y + RADIUS + 16}
        textAnchor="middle"
        fontSize={12}
        fontFamily="ui-monospace, Menlo, monospace"
        letterSpacing={3}
        fill={STROKE}
        fillOpacity={0.9}
      >
        APSΞLIΠΞ
      </text>
      <text
        x={STAR.x}
        y={STAR.y + RADIUS + 27}
        textAnchor="middle"
        fontSize={6}
        fontFamily="ui-monospace, Menlo, monospace"
        letterSpacing={2}
        fill={STROKE}
        fillOpacity={0.4}
      >
        ░ CORE ░
      </text>
    </g>
  );
}
