interface PlanetDotProps {
  x: number;
  y: number;
  colorVar: string;
  label: string;
  sublabel?: string;
  size?: 'primary' | 'outer';
  onClick?: () => void;
}

export function PlanetDot({ x, y, colorVar, label, sublabel, size = 'primary', onClick }: PlanetDotProps) {
  const stroke = `var(--${colorVar})`;
  const r = size === 'primary' ? 3 : 2;
  const fontSize = size === 'primary' ? 12 : 10;
  const subFontSize = size === 'primary' ? 6 : 5;
  const labelOffset = r + fontSize + 2;
  const subOffset = labelOffset + subFontSize + 5;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <circle cx={x} cy={y} r={r} fill={stroke} />
      <text
        x={x} y={y + labelOffset}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="ui-monospace, Menlo, monospace"
        letterSpacing={size === 'primary' ? 3 : 2}
        fill={stroke}
        fillOpacity={0.9}
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={x} y={y + subOffset}
          textAnchor="middle"
          fontSize={subFontSize}
          fontFamily="ui-monospace, Menlo, monospace"
          letterSpacing={2}
          fill={stroke}
          fillOpacity={0.4}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}
