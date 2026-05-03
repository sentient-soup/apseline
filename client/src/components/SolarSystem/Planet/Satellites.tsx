import type { Service } from '@apseline/shared';
import { satelliteSlotsForTier } from '../../../lib/geometry';

const TIER_RADII = [3.12, 4.32, 5.52];
const TIER_COUNT = TIER_RADII.length;
const TIER_PHASE = [0, Math.PI / 5, Math.PI / 3];

export interface SatelliteSlot {
  service: Service;
  tier: number;
  x: number;
  y: number;
  size: number;
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function distributeSatellites(services: Service[]): SatelliteSlot[] {
  const buckets: Service[][] = Array.from({ length: TIER_COUNT }, () => []);
  const sorted = [...services].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach((s, i) => buckets[i % TIER_COUNT].push(s));

  const slots: SatelliteSlot[] = [];
  buckets.forEach((tierServices, tier) => {
    const positions = satelliteSlotsForTier(tierServices.length, TIER_RADII[tier], TIER_PHASE[tier]);
    tierServices.forEach((service, i) => {
      const sizeRoll = ((hashName(service.name) % 2) + 1.4) * 0.1;
      slots.push({ service, tier, x: positions[i].x, y: positions[i].y, size: sizeRoll });
    });
  });
  return slots;
}

interface SatellitesProps {
  services: Service[];
  colorVar: string;
  opacity: number;
  onSelect: (serviceId: string) => void;
}

export function Satellites({ services, colorVar, opacity, onSelect }: SatellitesProps) {
  const slots = distributeSatellites(services);
  const fill = `var(--${colorVar})`;
  const usedTiers = new Set(slots.map((s) => s.tier));
  return (
    <g style={{ opacity }}>
      {TIER_RADII.map((r, i) => (
        usedTiers.has(i) ? (
          <ellipse
            key={`ring-${i}`}
            cx={0} cy={0} rx={r} ry={r}
            fill="none"
            stroke={fill}
            strokeOpacity={0.08}
            strokeWidth={0.03}
          />
        ) : null
      ))}
      {slots.map(({ service, x, y, size }) => (
        <g key={service.name}>
          <circle
            data-satellite
            cx={x} cy={y} r={size}
            fill={fill}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(service.name)}
          />
          <text
            x={x + size + 0.2} y={y + 0.15}
            fontSize={0.35} fontFamily="ui-monospace, Menlo, monospace"
            fill={fill} fillOpacity={0.9}
            style={{ pointerEvents: 'none' }}
          >
            {service.name}
          </text>
        </g>
      ))}
    </g>
  );
}
