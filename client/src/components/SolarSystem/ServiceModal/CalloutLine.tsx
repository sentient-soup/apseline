interface CalloutLineProps {
  fromX: number; fromY: number; toX: number; toY: number; colorVar: string;
}

export function CalloutLine({ fromX, fromY, toX, toY, colorVar }: CalloutLineProps) {
  const midX = (fromX + toX) / 2;
  return (
    <path
      d={`M ${fromX} ${fromY} L ${midX} ${fromY} L ${toX} ${toY}`}
      fill="none"
      stroke={`var(--${colorVar})`}
      strokeOpacity={0.5}
      strokeWidth={0.4}
    />
  );
}
