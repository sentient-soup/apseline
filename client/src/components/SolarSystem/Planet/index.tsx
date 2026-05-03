interface PlanetProps {
  x: number;
  y: number;
  colorVar: string;
  radius?: number;
  onClick?: () => void;
}

// Wireframe sphere: outer circle, latitude ellipses (varying ry by row),
// longitude ellipses (varying rx by column), faint halo.
export function Planet({ x, y, colorVar, radius = 16, onClick }: PlanetProps) {
  const stroke = `var(--${colorVar})`;
  // 5 latitudes: rows at -2,-1,0,1,2 of step. ry = radius * sin(angle).
  const lats = [-2, -1, 0, 1, 2].map((i) => {
    const a = (i / 3) * (Math.PI / 2); // -60°..60°
    const cy = Math.sin(a) * radius;
    const ry = Math.cos(a) * radius * 0.18; // ellipse flatness
    const rx = Math.cos(a) * radius;
    return { cy, rx, ry };
  });
  // 6 longitudes: ellipses sharing rx that varies by tilt
  const longs = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI; // 0..π
    const rx = Math.abs(Math.cos(a)) * radius;
    return { rx };
  });

  return (
    <g data-planet transform={`translate(${x} ${y})`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <circle data-outline r={radius} fill="none" stroke={stroke} strokeWidth={0.06} />
      {lats.map((l, i) => (
        <ellipse key={`lat-${i}`} cy={l.cy} rx={l.rx} ry={l.ry} fill="none" stroke={stroke} strokeOpacity={0.55} strokeWidth={0.035} />
      ))}
      {longs.map((l, i) => (
        <ellipse key={`lon-${i}`} rx={l.rx} ry={radius} fill="none" stroke={stroke} strokeOpacity={0.55} strokeWidth={0.035} />
      ))}
    </g>
  );
}
