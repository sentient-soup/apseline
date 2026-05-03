interface Props { x: number; y: number; colorVar: string }
export function SatelliteHighlight({ x, y, colorVar }: Props) {
  const stroke = `var(--${colorVar})`;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <circle r={0.45} fill="none" stroke={stroke} strokeWidth={0.04} />
      <circle r={0.7}  fill="none" stroke={stroke} strokeOpacity={0.4} strokeDasharray="0.12 0.18" strokeWidth={0.03} />
    </g>
  );
}
