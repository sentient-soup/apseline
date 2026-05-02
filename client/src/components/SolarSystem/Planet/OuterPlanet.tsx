interface OuterPlanetProps {
  x: number;
  y: number;
  colorVar: string;
  label: string;
  onClick?: () => void;
}

export function OuterPlanet({ x, y, colorVar, label, onClick }: OuterPlanetProps) {
  const stroke = `var(--${colorVar})`;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <g data-outer-planet transform={`translate(${x} ${y})`}>
        <circle r={9} fill="none" stroke={stroke} strokeWidth={0.4} />
        <ellipse rx={9} ry={9} fill="none" stroke={stroke} strokeWidth={0.3} transform="skewX(20)" />
        <circle r={1.2} fill={stroke} />
      </g>
      <text x={x} y={y + 25} textAnchor="middle" fontSize={8} fontFamily="ui-monospace, Menlo, monospace" letterSpacing={1} fill={stroke} fillOpacity={0.85}>
        {label}
      </text>
    </g>
  );
}
