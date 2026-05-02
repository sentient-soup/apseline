interface PlanetProps {
  x: number;
  y: number;
  colorVar: string;
  radius?: number;
  onClick?: () => void;
  hintSatellites?: boolean;
}

export function Planet({ x, y, colorVar, radius = 16, onClick, hintSatellites = true }: PlanetProps) {
  const stroke = `var(--${colorVar})`;
  return (
    <g data-planet transform={`translate(${x} ${y})`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <circle r={radius + 4} fill="none" stroke={stroke} strokeOpacity={0.15} strokeWidth={0.5} />
      <circle data-outline r={radius} fill="none" stroke={stroke} strokeWidth={0.5} />
      <ellipse rx={radius} ry={radius} fill="none" stroke={stroke} strokeWidth={0.4} transform="skewX(20) rotate(15)" />
      <ellipse rx={radius} ry={radius} fill="none" stroke={stroke} strokeWidth={0.4} transform="skewX(-20) rotate(-15)" />
      <circle r={2} fill={stroke} />
      {hintSatellites && (
        <g>
          <circle cx={radius + 4} cy={-3} r={1} fill={stroke} />
          <circle cx={-radius - 2} cy={5} r={1} fill={stroke} />
          <circle cx={0} cy={-radius - 4} r={1} fill={stroke} />
        </g>
      )}
    </g>
  );
}
