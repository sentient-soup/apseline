interface Props { x: number; y: number; colorVar: string }
export function SatelliteHighlight({ x, y, colorVar }: Props) {
  const stroke = `var(--${colorVar})`;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <circle r={9}  fill="none" stroke={stroke} strokeWidth={0.6} />
      <circle r={14} fill="none" stroke={stroke} strokeOpacity={0.4} strokeDasharray="2 3" strokeWidth={0.4} />
    </g>
  );
}
