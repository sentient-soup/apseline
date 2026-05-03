import { Planet } from './index';

interface OuterPlanetProps {
  x: number;
  y: number;
  colorVar: string;
  label: string;
  onClick?: () => void;
}

export function OuterPlanet({ x, y, colorVar, onClick }: OuterPlanetProps) {
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <Planet x={x} y={y} colorVar={colorVar} radius={0.67} />
    </g>
  );
}
