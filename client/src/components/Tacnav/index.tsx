import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { CloudflareMetrics, HealthState, MachineMetrics, PlanetMetrics } from '@apseline/shared';
import { useServicesStore } from '../../stores/servicesStore';
import { fmtBitsPerSec, fmtBytes, fmtCount, fmtLatency, fmtPct, fmtRelTime, fmtUptime } from '../../lib/format';
import './tacnav.css';

type Infra = 'perihelion' | 'aphelion';
type View = { kind: 'system' } | { kind: 'planet'; planet: Infra };

const META: Record<Infra, { desig: string; hex: string; code: string }> = {
  perihelion: { desig: 'PHL-01', hex: '#ffb45e', code: 'P' },
  aphelion: { desig: 'APH-02', hex: '#7cc4ff', code: 'A' },
};
const INFRAS: Infra[] = ['perihelion', 'aphelion'];

/* ---------------- geometry ---------------- */
const rad = (d: number) => (d * Math.PI) / 180;
function ptOnEllipse(cx: number, cy: number, rx: number, ry: number, rot: number, deg: number) {
  const t = rad(deg), r = rad(rot);
  const x = rx * Math.cos(t), y = ry * Math.sin(t);
  return { x: cx + x * Math.cos(r) - y * Math.sin(r), y: cy + x * Math.sin(r) + y * Math.cos(r) };
}
function ellipsePath(cx: number, cy: number, rx: number, ry: number, rot: number) {
  const p1 = ptOnEllipse(cx, cy, rx, ry, rot, 0), p2 = ptOnEllipse(cx, cy, rx, ry, rot, 180);
  return `M ${p1.x} ${p1.y} A ${rx} ${ry} ${rot} 1 1 ${p2.x} ${p2.y} A ${rx} ${ry} ${rot} 1 1 ${p1.x} ${p1.y} Z`;
}
function arcPath(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) {
  const p0 = ptOnEllipse(cx, cy, rx, ry, 0, a0), p1 = ptOnEllipse(cx, cy, rx, ry, 0, a1);
  return `M ${p0.x} ${p0.y} A ${rx} ${ry} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}
/* deterministic pseudo-random in [0,1) so shapes are stable across renders */
function hash01(...seeds: number[]) {
  let h = 2166136261;
  for (const s of seeds) { h ^= Math.round(s * 1013); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/* ---------------- health helpers ---------------- */
type Health = { st: HealthState; lat: string };
function useDomainData(infra: Infra) {
  const services = useServicesStore((s) => s.services);
  const health = useServicesStore((s) => s.health);
  const metrics = useServicesStore((s) => s.metrics);
  const config = useServicesStore((s) => s.config);
  const list = services.filter((s) => s.infrastructure === infra);
  const planet: PlanetMetrics | undefined = metrics?.[infra];
  const machines: MachineMetrics[] = planet?.machines
    ?? (config?.nodes?.[infra]?.machines ?? []).map((m) => ({ id: m.id, host: m.host, role: m.role, reachable: false }));
  return { list, health, planet, machines };
}
/** Keyed by service url - names collide across planets (e.g. "Copy Party"). */
function healthOf(health: Record<string, { state: HealthState; latencyMs?: number }>, url: string): Health {
  const h = health[url];
  if (!h) return { st: 'unknown', lat: fmtLatency(undefined) };
  return { st: h.state, lat: fmtLatency(h.latencyMs) };
}
const stColor = (st: HealthState) =>
  st === 'up' ? 'var(--up)' : st === 'degraded' ? 'var(--warn)' : st === 'down' ? 'var(--down)' : 'var(--dim)';
const stClass = (st: HealthState) => (st === 'degraded' ? 'warn' : st === 'down' ? 'down' : st === 'unknown' ? 'unk' : '');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'S'}`;

/* ---------------- svg pieces ---------------- */
function Starfield({ W, H }: { W: number; H: number }) {
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    x: hash01(i, 1) * W, y: hash01(i, 2) * H,
    r: hash01(i, 3) * 0.7 + 0.3, o: hash01(i, 4) * 0.5 + 0.15,
  })), [W, H]);
  return <g>{stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#3c5a55" opacity={s.o} />)}</g>;
}

function SegBar({ x, y, pct, color, cells = 12, cw = 4, ch = 5 }:
  { x: number; y: number; pct: number | undefined; color: string; cells?: number; cw?: number; ch?: number }) {
  const filled = pct === undefined ? 0 : Math.round((cells * pct) / 100);
  return <>{Array.from({ length: cells }, (_, i) => (
    <rect key={i} x={x + i * (cw + 1.5)} y={y} width={cw} height={ch} fill={i < filled ? color : 'var(--grid)'} />
  ))}</>;
}

function VitalsRows({ x, y, planet, color }: { x: number; y: number; planet?: PlanetMetrics; color: string }) {
  const rows: Array<[string, number | undefined]> = [
    ['CPU', planet?.aggregate.cpuPct], ['MEM', planet?.aggregate.memPct], ['DSK', planet?.aggregate.diskPct]];
  return <>{rows.map(([label, v], i) => {
    const yy = y + i * 9;
    return (
      <g key={label}>
        <text className="microlabel" x={x} y={yy + 4.5} fontSize={6.5}>{label}</text>
        <SegBar x={x + 22} y={yy} pct={v} color={v !== undefined && v > 80 ? 'var(--warn)' : color} cw={3.4} ch={4.4} />
        <text className="dimtext" x={x + 88} y={yy + 4.5} fontSize={7}>{fmtPct(v)}</text>
      </g>
    );
  })}</>;
}

/* wireframe graticule planet, drawn in local coords around (0,0) */
function WirePlanet({ infra, R, uid }: { infra: Infra; R: number; uid: string }) {
  const hex = META[infra].hex;
  const lat = (f: number) => {
    const y = R * f, hw = R * Math.cos(Math.asin(f));
    const q = y + R * 0.10 * Math.sign(f || 1) * (1 - Math.abs(f));
    return <path key={f} d={`M ${-hw} ${y} Q 0 ${q} ${hw} ${y}`} />;
  };
  return (
    <>
      <clipPath id={`wp-${uid}`}><circle r={R} /></clipPath>
      <circle r={R} fill="rgba(6,14,13,.78)" stroke={hex} strokeOpacity={0.85} strokeWidth={1} />
      <g clipPath={`url(#wp-${uid})`} stroke={hex} strokeOpacity={0.26} fill="none" strokeWidth={0.7}>
        <ellipse rx={R * 0.35} ry={R} /><ellipse rx={R * 0.7} ry={R} />
        <line x1={0} y1={-R} x2={0} y2={R} />
        {[0, 0.45, -0.45, 0.8, -0.8].map(lat)}
      </g>
      <ellipse className="scanMer" rx={R} ry={R} fill="none" stroke={hex} strokeOpacity={0.55} strokeWidth={0.8}>
        <animate attributeName="rx" values={`${R};1;${R}`} dur="11s" repeatCount="indefinite" />
      </ellipse>
      <g className="tickring">
        <circle r={R * 1.16} fill="none" stroke={hex} strokeOpacity={0.3} strokeWidth={0.7} strokeDasharray="1 6" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const p1 = ptOnEllipse(0, 0, R * 1.12, R * 1.12, 0, a), p2 = ptOnEllipse(0, 0, R * 1.22, R * 1.22, 0, a);
          return <line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={hex} strokeOpacity={0.45} strokeWidth={0.8} />;
        })}
      </g>
    </>
  );
}

function ContactShape({ st }: { st: HealthState }) {
  if (st === 'down') {
    return (
      <g className="dx" stroke="var(--down)" strokeWidth={1.3}>
        <line x1={-3.4} y1={-3.4} x2={3.4} y2={3.4} /><line x1={-3.4} y1={3.4} x2={3.4} y2={-3.4} />
      </g>
    );
  }
  return <rect className="df" x={-3.1} y={-3.1} width={6.2} height={6.2} transform="rotate(45)" />;
}

/* service contacts orbiting a planet at system scale */
function ContactRings({ infra, R }: { infra: Infra; R: number }) {
  const { list, health } = useDomainData(infra);
  const hex = META[infra].hex;
  const ringSpecs: Array<[number, number]> = [[2.3, -12], [3.1, 8], [3.9, -4]];
  const nRings = list.length > 10 ? 3 : 2;
  const per = Math.max(1, Math.ceil(list.length / nRings));
  const out: ReactElement[] = [];
  list.forEach((s, i) => {
    const ring = Math.min(Math.floor(i / per), nRings - 1);
    const [mult, rot] = ringSpecs[ring];
    const rx = R * mult, ry = rx * 0.44;
    const pathId = `cring-${infra}-${ring}`;
    if (i % per === 0) {
      out.push(<path key={pathId} id={pathId} d={ellipsePath(0, 0, rx, ry, rot)} className="ringLine" stroke={hex} strokeDasharray="1 4" />);
    }
    const idx = i % per, tot = Math.min(per, list.length - ring * per);
    const phase = (idx / tot) * 360 + ring * 29;
    const h = healthOf(health, s.url);
    const dur = 50 + ring * 24;
    const stalled = h.st === 'down';
    const p = stalled ? ptOnEllipse(0, 0, rx, ry, rot, phase) : null;
    out.push(
      <g key={s.url} className={`mote ${stClass(h.st)}`} data-svc={s.url} data-dom={infra}
        transform={p ? `translate(${p.x},${p.y})` : undefined}>
        {!p && (
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`-${((phase / 360) * dur).toFixed(1)}s`}>
            <mpath href={`#${pathId}`} />
          </animateMotion>
        )}
        <g className="diam"><circle r={9} fill="transparent" /><ContactShape st={h.st} /></g>
      </g>
    );
  });
  return <>{out}</>;
}

/* Cloudflare edge rendered as an asteroid belt: one rock per metric */
function AsteroidBelt({ cx, cy, W, H, P }: { cx: number; cy: number; W: number; H: number; P: boolean }) {
  const cf: CloudflareMetrics | undefined = useServicesStore((s) => s.metrics?.cloudflare);
  if (!cf) return null;
  const threats = cf.zones.reduce((a, z) => a + (z.threats24h ?? 0), 0);
  const bandwidth = cf.zones.reduce((a, z) => a + (z.bandwidthBytes24h ?? 0), 0);
  const visitors = cf.zones.reduce((a, z) => a + (z.uniqueVisitors24h ?? 0), 0);
  const rocks: Array<{ key: string; label: string; value: string; detail: string; hot?: boolean }> = [
    { key: 'req', label: 'REQ 24H', value: fmtCount(cf.totalRequests24h), detail: cf.zones.map((z) => `${z.zone} ${fmtCount(z.requests24h)}`).join(' · ') },
    { key: 'cache', label: 'CACHE', value: fmtPct((cf.averageCacheHitRatio ?? 0) * 100), detail: 'AVG CACHE HIT RATIO ACROSS ZONES' },
    { key: 'threats', label: 'THREATS', value: String(threats), detail: threats ? 'BLOCKED AT THE EDGE · 24H WINDOW' : 'NO THREATS IN 24H WINDOW', hot: threats > 0 },
    { key: 'bw', label: 'BANDWIDTH', value: fmtBytes(bandwidth), detail: `UNIQUE VISITORS ${fmtCount(visitors)}` },
  ];
  const rx = W * (P ? 0.465 : 0.468), ry = H * (P ? 0.47 : 0.44);

  const rockPath = (r: number, seed: number) => {
    const pts = Array.from({ length: 8 }, (_, i) => {
      const rr = r * (0.68 + 0.38 * hash01(seed, i));
      const a = (i / 8) * 360 + hash01(seed, i + 20) * 18;
      return `${(rr * Math.cos(rad(a))).toFixed(1)},${(rr * Math.sin(rad(a))).toFixed(1)}`;
    });
    return `M ${pts.join(' L ')} Z`;
  };

  /* the belt is three concentric lanes so rocks have radial spread while orbiting */
  const LANES = [0.965, 1.0, 1.035];
  const debris = Array.from({ length: 16 }, (_, i) => ({
    lane: i % 3,
    phase: 360 * hash01(i, 5),
    dur: 1500 + 900 * hash01(i, 6),
    d: rockPath(2 + 2.5 * hash01(i, 8), i + 40),
    spin: 50 + hash01(i, 9) * 60,
  }));
  const ROCK_DUR = 1900;
  const capTop = ptOnEllipse(cx, cy, rx, ry, 0, -90);

  return (
    <g>
      {LANES.map((f, i) => (
        <path key={i} id={`belt-${i}`} d={ellipsePath(cx, cy, rx * f, ry * f, 0)} fill="none"
          stroke={i === 1 ? 'var(--cf)' : 'none'} strokeOpacity={0.18} strokeWidth={i === 1 ? 10 : 0} strokeDasharray="1 3" />
      ))}
      {debris.map((r, i) => (
        <g key={i} opacity={0.5}>
          <animateMotion dur={`${r.dur.toFixed(0)}s`} repeatCount="indefinite" begin={`-${((r.phase / 360) * r.dur).toFixed(0)}s`}>
            <mpath href={`#belt-${r.lane}`} />
          </animateMotion>
          <path d={r.d} fill="none" stroke="var(--cf)" strokeWidth={0.8}>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={`${r.spin}s`} repeatCount="indefinite" />
          </path>
        </g>
      ))}
      {rocks.map((rock, i) => {
        const phase = 45 + i * 90; /* diagonals, clear of the caution and target plates */
        const rSz = 7 + 2 * hash01(i, 10);
        const col = rock.hot ? 'var(--down)' : 'var(--cf)';
        return (
          <g key={rock.key} className="asteroid" opacity={0.85}
            data-cf={rock.key} data-cf-label={rock.label} data-cf-value={rock.value} data-cf-detail={rock.detail}>
            <animateMotion dur={`${ROCK_DUR}s`} repeatCount="indefinite" begin={`-${((phase / 360) * ROCK_DUR).toFixed(0)}s`}>
              <mpath href="#belt-1" />
            </animateMotion>
            <circle r={rSz + 8} fill="transparent" />
            <g className="rock">
              <path d={rockPath(rSz, i + 90)} fill="rgba(6,14,13,.8)" stroke={col} strokeWidth={1.1}>
                <animateTransform attributeName="transform" type="rotate" from="0" to={i % 2 ? '-360' : '360'} dur={`${80 + i * 22}s`} repeatCount="indefinite" />
              </path>
            </g>
            <text className="datatext" y={rSz + 13} textAnchor="middle" fontSize={8.5} fill={col}>{rock.value}</text>
            <text className="microlabel" y={rSz + 23} textAnchor="middle" fontSize={6}>{rock.label}</text>
          </g>
        );
      })}
      <text className="cfText" x={cx} y={P ? H * 0.06 : capTop.y - 12} textAnchor="middle" fontSize={7.5}>
        PERIMETER BELT // CLOUDFLARE
      </text>
    </g>
  );
}

/* ---------------- SYSTEM scene ---------------- */
function PlanetAssembly({ infra, R, pos, dur, begin, flip, reduced }:
  { infra: Infra; R: number; pos: { x: number; y: number }; dur: number; begin: number; flip: boolean; reduced: boolean }) {
  const { list, health, planet, machines } = useDomainData(infra);
  const meta = META[infra];
  const sUp = list.filter((s) => healthOf(health, s.url).st !== 'down').length;
  const mUp = planet?.aggregate.machinesUp ?? machines.filter((m) => m.reachable).length;
  const base = R * 3.9 * 0.44;
  const nameY = flip ? -(base + 30) : base + 18;
  const countY = flip ? -(base + 17) : base + 31;
  const barsY = flip ? -(base + 72) : base + 41;
  return (
    <g className="planetAsm" transform={reduced ? `translate(${pos.x},${pos.y})` : undefined}>
      {!reduced && (
        <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`-${begin}s`}>
          <mpath href={`#orb-${infra}`} />
        </animateMotion>
      )}
      <g className="planetG" data-planet={infra}>
        <circle r={R * 1.5} fill="transparent" />
        <WirePlanet infra={infra} R={R} uid={`sys-${infra}`} />
        <g className="lockHint" stroke={meta.hex} strokeWidth={1} fill="none">
          <path d={`M ${-R * 1.4} ${-R * 1.4 + 7} v-7 h7`} /><path d={`M ${R * 1.4} ${-R * 1.4 + 7} v-7 h-7`} />
          <path d={`M ${R * 1.4} ${R * 1.4 - 7} v7 h-7`} /><path d={`M ${-R * 1.4} ${R * 1.4 - 7} v7 h7`} />
        </g>
      </g>
      <ContactRings infra={infra} R={R} />
      <text className="datatext" textAnchor="middle" y={nameY} fontSize={12} letterSpacing=".4em">{infra.toUpperCase()}</text>
      <text className="microlabel" textAnchor="middle" y={countY} fontSize={7}>
        {meta.desig} · {mUp}/{machines.length} NODES · {sUp}/{list.length} SVCS
      </text>
      <g transform={`translate(-52,${barsY})`}><VitalsRows x={0} y={0} planet={planet} color={meta.hex} /></g>
    </g>
  );
}

function SystemScene({ W, H }: { W: number; H: number }) {
  const health = useServicesStore((s) => s.health);
  const services = useServicesStore((s) => s.services);
  const alertCount = services.filter((s) => ['down', 'degraded'].includes(healthOf(health, s.url).st)).length;
  const upFrac = services.length ? services.filter((s) => healthOf(health, s.url).st !== 'down').length / services.length : 1;
  const P = W < H;
  const cx = W / 2, cy = P ? H * 0.46 : H / 2;
  const o1 = P ? { rx: W * 0.40, ry: H * 0.20 } : { rx: W * 0.235, ry: W * 0.235 * 0.34 };
  const o2 = P ? { rx: W * 0.34, ry: H * 0.30 } : { rx: W * 0.37, ry: W * 0.37 * 0.34 };
  const periR = P ? W * 0.058 : H * 0.031;
  const apheR = P ? W * 0.049 : H * 0.026;
  const periDur = 760, apheDur = 1180;
  /* orbit paths start rightmost and sweep clockwise: .25 bottom, .5 left, .75 top */
  const periBegin = P ? periDur * 0.75 : periDur * 0.5;
  const apheBegin = P ? apheDur * 0.25 : apheDur * 0.001;
  const coreR = P ? W * 0.045 : H * 0.026;
  const statusCol = alertCount ? 'var(--warn)' : 'var(--up)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="coreGlow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <Starfield W={W} H={H} />
      {(() => {
        /* euclidean grid aligned so lines intersect at the core */
        const STEP = H * 0.085;
        const verts: number[] = [], horzs: number[] = [];
        for (let x = cx % STEP; x <= W; x += STEP) verts.push(x);
        for (let y = cy % STEP; y <= H; y += STEP) horzs.push(y);
        const marks: Array<[number, number]> = [];
        for (let x = cx % (STEP * 4); x <= W; x += STEP * 4) {
          for (let y = cy % (STEP * 4); y <= H; y += STEP * 4) marks.push([x, y]);
        }
        return (
          <>
            {verts.map((x) => <line key={`v${x}`} className="gridline" x1={x} y1={0} x2={x} y2={H} />)}
            {horzs.map((y) => <line key={`h${y}`} className="gridline" x1={0} y1={y} x2={W} y2={y} />)}
            <line x1={cx} y1={0} x2={cx} y2={H} stroke="var(--grid-ink)" strokeOpacity={0.4} />
            <line x1={0} y1={cy} x2={W} y2={cy} stroke="var(--grid-ink)" strokeOpacity={0.4} />
            {marks.map(([x, y]) => (
              <path key={`m${x},${y}`} d={`M ${x - 4} ${y} H ${x + 4} M ${x} ${y - 4} V ${y + 4}`} stroke="var(--grid-ink)" strokeOpacity={0.8} fill="none" />
            ))}
          </>
        );
      })()}
      <AsteroidBelt cx={cx} cy={cy} W={W} H={H} P={P} />
      <path id="orb-perihelion" d={ellipsePath(cx, cy, o1.rx, o1.ry, 0)} className="orbitLine" />
      <path id="orb-aphelion" d={ellipsePath(cx, cy, o2.rx, o2.ry, 0)} className="orbitLine" />
      <g className="starG" id="starBtn" transform={`translate(${cx},${cy})`}>
        <circle r={coreR * 2.6} fill="transparent" />
        <g className="tickringB">
          <circle r={coreR * 2.2} fill="none" stroke="var(--dim)" strokeOpacity={0.4} strokeWidth={0.7} strokeDasharray="8 6" />
        </g>
        {[0, 90, 180, 270].map((a) => {
          const p1 = ptOnEllipse(0, 0, coreR * 1.95, coreR * 1.95, 0, a);
          const p2 = ptOnEllipse(0, 0, coreR * 2.3, coreR * 2.3, 0, a);
          return <line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--dim)" strokeOpacity={0.55} strokeWidth={0.8} />;
        })}
        {/* health gauge: lit ticks = fraction of services responding, remainder reads as damage */}
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * 360 - 90;
          const lit = i < Math.round(48 * upFrac);
          const p1 = ptOnEllipse(0, 0, coreR * 1.42, coreR * 1.42, 0, a);
          const p2 = ptOnEllipse(0, 0, coreR * 1.72, coreR * 1.72, 0, a);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={lit ? 'var(--up)' : alertCount ? 'var(--down)' : 'var(--grid)'}
            strokeOpacity={lit ? 0.9 : 0.7} strokeWidth={1} />;
        })}
        <circle r={coreR * 1.28} fill="none" stroke="var(--ink)" strokeOpacity={0.3} strokeWidth={0.7} />
        <circle r={coreR * 0.85} fill="#0a1512" stroke={statusCol} strokeOpacity={0.9} strokeWidth={1} />
        <circle r={coreR * 1.15} fill={statusCol} opacity={0.15} filter="url(#coreGlow)" />
        <circle className="corePulse" r={coreR * 0.34} fill={statusCol} />
        <text className="microlabel" y={coreR * 2.6 + 16} textAnchor="middle" fontSize={7}>
          CORE · {alertCount ? plural(alertCount, 'ALERT') : 'STATUS NOMINAL'}
        </text>
      </g>
      <PlanetAssembly infra="perihelion" R={periR} pos={{ x: P ? cx : cx - o1.rx, y: P ? cy - o1.ry : cy }} dur={periDur} begin={periBegin} flip={P} reduced={false} />
      <PlanetAssembly infra="aphelion" R={apheR} pos={{ x: P ? cx : cx + o2.rx, y: P ? cy + o2.ry : cy }} dur={apheDur} begin={apheBegin} flip={false} reduced={false} />
    </svg>
  );
}

/* ---------------- PLANET scene ---------------- */
function PlanetScene({ infra, W, H }: { infra: Infra; W: number; H: number }) {
  const { list, health, machines } = useDomainData(infra);
  const meta = META[infra];
  const P = W < H;
  const R = P ? W * 0.27 : H * 0.26;
  /* keep room to the left for station plates on narrow landscape windows */
  const px = P ? W / 2 : Math.max(W * 0.34, R + 270);
  const py = P ? H * 0.26 : H * 0.53;

  const n = list.length;
  const perShell = P ? 5 : 9;
  const shells = Math.max(1, Math.ceil(n / perShell));
  const shellR = (s: number) => R * (P ? 1.8 + 0.54 * s : 1.55 + 0.44 * s);
  const shellAngles = (r: number) => {
    if (!P) return { a0: -58, a1: 52 };
    const d2 = Math.min(58, (Math.asin(Math.min(1, (W * 0.38) / r)) * 180) / Math.PI);
    return { a0: 90 - d2, a1: 90 + d2 };
  };
  const stationAngle = (i: number) => -38 + i * 60;

  const sUp = list.filter((s) => healthOf(health, s.url).st !== 'down').length;
  const mUp = machines.filter((m) => m.reachable).length;
  /* landscape: caption above the planet (TARGET plate owns bottom-center);
     portrait: caption in the gap between the moon fan and the station plates */
  const capY = P ? H - 178 : py - R - 42;
  const domain = infra === 'perihelion' ? 'perihelion.live' : 'aphelion.live';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <Starfield W={W} H={H} />
      <path d={arcPath(px, py, R * 4.6, R * 4.4, P ? -40 : 110, P ? 220 : 250)} className="orbitLine" opacity={0.4} />
      {Array.from({ length: shells }, (_, s) => {
        const r = shellR(s), ang = shellAngles(r);
        return <path key={s} d={arcPath(px, py, r, r * 0.96, ang.a0 - 8, ang.a1 + 8)} className="ringLine" stroke={meta.hex} strokeDasharray="1 5" />;
      })}
      <g transform={`translate(${px},${py})`}>
        <WirePlanet infra={infra} R={R} uid={`pl-${infra}`} />
        {machines.map((m, i) => {
          const p = ptOnEllipse(0, 0, R * 0.62, R * 0.62, 0, 180 + stationAngle(i));
          return (
            <g key={m.id}>
              <rect className="stationDot" x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} fill="none" stroke={m.reachable ? meta.hex : 'var(--down)'} strokeWidth={1.1} />
              <circle cx={p.x} cy={p.y} r={1.2} fill={m.reachable ? meta.hex : 'var(--down)'} />
            </g>
          );
        })}
      </g>
      {machines.map((m, i) => {
        const bw = P ? Math.min(192, (W - 28) / machines.length - 8) : 192;
        const bx = P ? 14 + i * ((W - 28) / machines.length) : px - R - 250;
        const by = P ? H - 150 : py - 100 + i * 122;
        const mp = ptOnEllipse(px, py, R * 0.62, R * 0.62, 0, 180 + stationAngle(i));
        const ep = ptOnEllipse(px, py, R * 1.1, R * 1.1, 0, 180 + stationAngle(i));
        const rows: Array<[string, number | undefined]> = [['CPU', m.cpuPct], ['MEM', m.memPct], ['DSK', m.diskPct]];
        return (
          <g key={m.id}>
            {!P && (
              <>
                <polyline points={`${mp.x},${mp.y} ${ep.x},${ep.y} ${bx + bw},${by + 22}`} fill="none" stroke={meta.hex} strokeOpacity={0.4} strokeWidth={1} />
                <circle cx={mp.x} cy={mp.y} r={2} fill={meta.hex} />
              </>
            )}
            <rect x={bx} y={by} width={bw} height={96} fill="rgba(5,12,11,.78)" stroke="var(--faint)" />
            <rect x={bx} y={by} width={bw} height={15} fill={m.reachable ? meta.hex : 'var(--down)'} opacity={0.14} />
            <text className="datatext" x={bx + 8} y={by + 11} fontSize={9} letterSpacing=".26em">{m.id.toUpperCase()}</text>
            <text className="microlabel" x={bx + bw - 8} y={by + 11} textAnchor="end" fontSize={7}>{m.role?.toUpperCase() ?? 'NODE'}</text>
            <text className="microlabel" x={bx + 8} y={by + 26} fontSize={7} fill={m.reachable ? undefined : 'var(--down)'}>
              {m.reachable ? `UP ${fmtUptime(m.uptimeSeconds)}` : 'UNREACHABLE'}
            </text>
            {rows.map(([label, v], j) => {
              const yy = by + 36 + j * 13;
              return (
                <g key={label}>
                  <text className="microlabel" x={bx + 8} y={yy} fontSize={7.5}>{label}</text>
                  <SegBar x={bx + 34} y={yy - 6} pct={v} color={v !== undefined && v > 80 ? 'var(--warn)' : meta.hex} cells={14} cw={4.6} ch={5.5} />
                  <text className="datatext" x={bx + 128} y={yy} fontSize={8.5}>{fmtPct(v)}</text>
                </g>
              );
            })}
            <text className="dimtext" x={bx + 8} y={by + 88} fontSize={7.5}>
              NET ↑{fmtBitsPerSec(m.netTxBps)} ↓{fmtBitsPerSec(m.netRxBps)}
            </text>
          </g>
        );
      })}
      {list.map((s, i) => {
        const shell = Math.floor(i / perShell);
        const inShell = Math.min(perShell, n - shell * perShell);
        const idx = i % perShell;
        const r = shellR(shell);
        const { a0, a1 } = shellAngles(r);
        const spread = a1 - a0;
        const a = inShell === 1 ? (a0 + a1) / 2 : a0 + (idx / (inShell - 1)) * spread + (shell % 2 ? spread * 0.04 : -spread * 0.04);
        const p = ptOnEllipse(px, py, r, r * 0.96, 0, a);
        const h = healthOf(health, s.url);
        const rightSide = p.x >= px;
        const anchor = P ? (p.x < 62 ? 'start' : p.x > W - 62 ? 'end' : 'middle') : rightSide ? 'start' : 'end';
        const lx = P ? (p.x < 62 ? -8 : p.x > W - 62 ? 8 : 0) : rightSide ? 12 : -12;
        const ly = P ? 16 : 3.5;
        const code = META[infra].code + String(i + 1).padStart(2, '0');
        return (
          <g key={s.url} className={`moon mote ${stClass(h.st)}`} data-svc={s.url} data-dom={infra} transform={`translate(${p.x},${p.y})`}>
            <circle r={P ? 15 : 13} fill="transparent" />
            <g className="diam"><ContactShape st={h.st} /></g>
            <circle r={7.5} fill="none" stroke={stColor(h.st)} strokeOpacity={0.3} strokeWidth={0.7} />
            <text x={lx} y={ly} textAnchor={anchor} fontSize={P ? 8.5 : 9.5} fill="var(--dim)" letterSpacing=".16em">
              <tspan fill="var(--faint)">{code} </tspan>{s.name.toUpperCase()}
            </text>
          </g>
        );
      })}
      <text className="datatext" x={P ? W / 2 : px} y={capY} textAnchor="middle" fontSize={15} letterSpacing=".44em">{infra.toUpperCase()}</text>
      <text className="microlabel" x={P ? W / 2 : px} y={capY + 15} textAnchor="middle" fontSize={7.5}>
        {meta.desig} · {mUp}/{machines.length} NODES · {sUp}/{list.length} SERVICES · {domain.toUpperCase()}
      </text>
    </svg>
  );
}

/* ---------------- root component ---------------- */
type Tgt =
  | { kind: 'idle' }
  | { kind: 'svc'; url: string }
  | { kind: 'planet'; infra: Infra }
  | { kind: 'cf'; label: string; value: string; detail: string };

export function Tacnav() {
  const services = useServicesStore((s) => s.services);
  const health = useServicesStore((s) => s.health);
  const metrics = useServicesStore((s) => s.metrics);
  const config = useServicesStore((s) => s.config);
  const refreshServices = useServicesStore((s) => s.refreshServices);

  const [view, setView] = useState<View>({ kind: 'system' });
  const [prev, setPrev] = useState<{ view: View; cls: 'zoom-away' | 'recede'; origin?: string } | null>(null);
  const [dims, setDims] = useState({ W: 1200, H: 800 });
  const [clock, setClock] = useState('--:--:--Z');
  const [tgt, setTgt] = useState<Tgt>({ kind: 'idle' });
  const [toast, setToast] = useState<{ msg: string; on: boolean }>({ msg: '', on: false });
  const [alertsOpen, setAlertsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const toastT = useRef<number | undefined>(undefined);

  const alertList = useMemo(() =>
    services
      .map((s) => ({ s, h: health[s.url] }))
      .filter((x) => x.h && (x.h.state === 'down' || x.h.state === 'degraded'))
      .map((x) => ({
        key: x.s.url, svc: x.s.name, st: x.h!.state,
        msg: x.h!.state === 'down' ? (x.h!.error?.toUpperCase() ?? 'NO RESPONSE') : `LATENCY ${fmtLatency(x.h!.latencyMs)}`,
      })),
    [services, health]);

  const counts = useMemo(() => {
    let sUp = 0, mUp = 0, mTot = 0;
    for (const s of services) if (healthOf(health, s.url).st !== 'down') sUp++;
    for (const k of INFRAS) {
      const agg = metrics?.[k]?.aggregate;
      if (agg) { mUp += agg.machinesUp; mTot += agg.machinesTotal; }
    }
    return { sUp, sTot: services.length, mUp, mTot };
  }, [services, health, metrics]);

  const threats = metrics?.cloudflare?.zones.reduce((a, z) => a + (z.threats24h ?? 0), 0) ?? 0;

  /* clock */
  useEffect(() => {
    const t = window.setInterval(() => {
      const d = new Date();
      const p = (v: number) => String(v).padStart(2, '0');
      setClock(`${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* viewport-aspect viewBox */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) setDims({ W: Math.max(320, Math.round((r.width / r.height) * 800)), H: 800 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* crosshair cursor */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !matchMedia('(pointer:fine)').matches) return;
    const xh = root.querySelector<HTMLElement>('#xhair')!;
    const xco = root.querySelector<HTMLElement>('#xco')!;
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0;
    const onMove = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; root.classList.add('aimed'); };
    const loop = () => {
      x += (tx - x) * 0.4; y += (ty - y) * 0.4;
      xh.style.transform = `translate(${x}px,${y}px)`;
      xco.style.transform = `translate(${x + 26}px,${y + 18}px)`;
      xco.textContent = `X ${String(Math.round(tx)).padStart(4, '0')} Y ${String(Math.round(ty)).padStart(4, '0')}`;
      raf = requestAnimationFrame(loop);
    };
    addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(loop);
    return () => { removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);

  /* hover: crosshair lock + target plate (delegated, contacts are SMIL-animated) */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const HOT = '[data-svc],[data-planet],[data-cf],#starBtn,.dock,#backBtn,#brand';
    const over = (e: Event) => {
      const t = e.target as Element;
      const hot = t.closest(HOT);
      root.querySelector('#xhair')?.classList.toggle('lock', !!hot);
      root.querySelector('#xco')?.classList.toggle('lock', !!hot);
      const svc = t.closest<SVGElement>('[data-svc]');
      if (svc) { setTgt({ kind: 'svc', url: svc.dataset.svc! }); return; }
      const pl = t.closest<SVGElement>('[data-planet]');
      if (pl) { setTgt({ kind: 'planet', infra: pl.dataset.planet as Infra }); return; }
      const cf = t.closest<SVGElement>('[data-cf]');
      if (cf) setTgt({ kind: 'cf', label: cf.dataset.cfLabel!, value: cf.dataset.cfValue!, detail: cf.dataset.cfDetail! });
    };
    const out = (e: Event) => {
      const t = e.target as Element;
      if (t.closest('[data-svc],[data-planet],[data-cf]')) setTgt({ kind: 'idle' });
      if (t.closest(HOT)) {
        root.querySelector('#xhair')?.classList.remove('lock');
        root.querySelector('#xco')?.classList.remove('lock');
      }
    };
    root.addEventListener('pointerover', over);
    root.addEventListener('pointerout', out);
    return () => { root.removeEventListener('pointerover', over); root.removeEventListener('pointerout', out); };
  }, []);

  /* escape returns to system view */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView((v) => (v.kind === 'planet' ? { kind: 'system' } : v));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const showToast = (msg: string) => {
    setToast({ msg, on: true });
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast((t) => ({ ...t, on: false })), 2100);
  };

  const navigate = (next: View, origin?: { x: number; y: number }) => {
    setPrev({ view, cls: origin ? 'zoom-away' : 'recede', origin: origin ? `${origin.x}px ${origin.y}px` : undefined });
    setView(next);
    window.setTimeout(() => setPrev(null), 520);
  };

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as Element;
    if (alertsOpen) { setAlertsOpen(false); return; }
    const svcEl = t.closest<SVGElement>('[data-svc]');
    if (svcEl) {
      const svc = services.find((s) => s.url === svcEl.dataset.svc);
      if (svc) {
        // Non-http entries (game servers) aren't launchable - opening them
        // resolved as a relative path against the dashboard's own origin.
        if (/^https?:\/\//i.test(svc.url)) {
          showToast(`LAUNCH ▸ ${svc.name.toUpperCase()}`);
          window.open(svc.url, '_blank', 'noopener');
        } else {
          showToast(`${svc.name.toUpperCase()} ▸ ${svc.url}`);
        }
      }
      return;
    }
    const pl = t.closest<SVGElement>('[data-planet]');
    if (pl) {
      const r = pl.getBoundingClientRect();
      navigate({ kind: 'planet', planet: pl.dataset.planet as Infra }, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      return;
    }
    if (t.closest('#starBtn') || t.closest('#alertDock')) { setAlertsOpen(true); return; }
    if (t.closest('#backBtn') || t.closest('#brand')) {
      if (view.kind === 'planet') navigate({ kind: 'system' });
      return;
    }
    if (t.closest('.d-dis')) { refreshServices(); showToast('DISCOVERY SWEEP REQUESTED'); return; }
    if (t.closest('.dock')) showToast('PANEL NOT WIRED YET');
  };

  const renderScene = (v: View) =>
    v.kind === 'system'
      ? <SystemScene W={dims.W} H={dims.H} />
      : <PlanetScene infra={v.planet} W={dims.W} H={dims.H} />;

  const tgtBody = () => {
    if (tgt.kind === 'svc') {
      const h = healthOf(health, tgt.url);
      const svc = services.find((s) => s.url === tgt.url);
      const cls = h.st === 'degraded' ? 't-warn' : h.st === 'down' ? 't-down' : h.st === 'unknown' ? 't-unk' : 't-up';
      return (
        <>
          <span className="t-name">TGT // {(svc?.name ?? tgt.url).toUpperCase()}</span>
          <div className="t-row">
            <span className={cls}>{h.st.toUpperCase()} · {h.lat}</span>
            {` · ${tgt.url.replace(/^https?:\/\//, '')} · `}
            {/^https?:\/\//i.test(tgt.url) ? 'CLICK TO LAUNCH' : 'NOT AN HTTP ENDPOINT'}
          </div>
        </>
      );
    }
    if (tgt.kind === 'planet') {
      const { list, health: hm, machines } = { list: services.filter((s) => s.infrastructure === tgt.infra), health: health, machines: metrics?.[tgt.infra]?.machines ?? [] };
      const sUp = list.filter((s) => healthOf(hm, s.url).st !== 'down').length;
      const mUp = machines.filter((m) => m.reachable).length;
      return (
        <>
          <span className="t-name">TGT // {tgt.infra.toUpperCase()}</span>
          <div className="t-row">{META[tgt.infra].desig} · {mUp}/{machines.length} NODES · {sUp}/{list.length} SVCS · CLICK TO FOCUS</div>
        </>
      );
    }
    if (tgt.kind === 'cf') {
      return (
        <>
          <span className="t-name">CF // {tgt.label}</span>
          <div className="t-row">{tgt.value} · {tgt.detail}</div>
        </>
      );
    }
    return (
      <>
        <span className="t-name">NO TARGET</span>
        <div className="t-row">PASSIVE TRACK · HOVER A CONTACT</div>
      </>
    );
  };

  const incident = alertList.length > 0;
  const telemetryAge = metrics?.generatedAt ? fmtRelTime(metrics.generatedAt) : 'NO LINK';
  const cf = metrics?.cloudflare;

  return (
    <div ref={rootRef} onClick={onClick}
      className={`tacnav-root${incident ? ' incident' : ''}${view.kind === 'planet' ? ' in-planet' : ''}`}>
      <div id="stage" ref={stageRef}>
        {prev && (
          <div className={`scene ${prev.cls}`} style={prev.origin ? { transformOrigin: prev.origin } : undefined}>
            {renderScene(prev.view)}
          </div>
        )}
        <div className={`scene ${prev ? (prev.cls === 'zoom-away' ? 'fade-up' : 'fade-back') : ''}`}>
          {renderScene(view)}
        </div>
      </div>
      <div id="ruler" />
      <div className="frame" id="fTL" /><div className="frame" id="fTR" />
      <div className="frame" id="fBL" /><div className="frame" id="fBR" />

      <div className="hud" id="hudTL">
        <div id="brand">APSELINE <b>//</b> <span id="crumb">{view.kind === 'system' ? 'TACNAV' : `NODE: ${view.planet.toUpperCase()}`}</span></div>
        <div id="verdict">{incident ? `SYSTEMS DEGRADED · ${plural(alertList.length, 'ALERT')}` : 'ALL SYSTEMS NOMINAL'}</div>
        <div id="subline">NODES {counts.mUp}/{counts.mTot || '?'} · SVCS {counts.sUp}/{counts.sTot} · PERIMETER {plural(threats, 'THREAT')}</div>
        <div id="backBtn">◂ SYS VIEW [ESC]</div>
      </div>
      <div className="hud" id="hudTR">
        <div className="t">{clock}</div>
        <div>REFRESH {config?.refreshInterval ?? '--'}S</div>
      </div>
      <div className="hud" id="hudBL">
        <div>TELEMETRY ▸ {telemetryAge.toUpperCase()}</div>
        <div>{cf ? `CF EDGE · ${fmtCount(cf.totalRequests24h)} REQ 24H · ${fmtPct((cf.averageCacheHitRatio ?? 0) * 100)} CACHE` : 'CF EDGE · NO DATA'}</div>
      </div>
      <div className="hud" id="hudBR">
        <span className="dock d-set">settings</span>
        <span className="dock d-log">logs</span>
        <span className="dock d-dis">discovery</span>
        <span className="dock d-al" id="alertDock">alerts ({alertList.length})</span>
      </div>

      <div id="caution">▲ MASTER CAUTION · {plural(alertList.length, 'ALERT')}</div>
      <div id="tgt">{tgtBody()}</div>
      <div id="toast" className={toast.on ? 'show' : ''}>{toast.msg}</div>
      {alertsOpen && (
        <div id="alertPanel">
          <h3>ALERT REGISTER</h3>
          {alertList.length
            ? alertList.map((a) => (
              <div key={a.key} className={a.st === 'down' ? 'a-down' : 'a-warn'}>
                {a.st === 'down' ? '✕' : '▲'} {a.svc.toUpperCase()} · {a.st.toUpperCase()} · {a.msg}
              </div>
            ))
            : <div className="a-ok">■ REGISTER EMPTY · {counts.sUp}/{counts.sTot} RESPONDING</div>}
          <div className="a-close">CLICK ANYWHERE TO CLOSE</div>
        </div>
      )}

      <div id="xhair">
        <svg viewBox="0 0 48 48">
          <g stroke="var(--ink)" strokeWidth={1} fill="none">
            <circle className="xring" cx={24} cy={24} r={10} opacity={0.7} />
            <line x1={24} y1={2} x2={24} y2={12} /><line x1={24} y1={36} x2={24} y2={46} />
            <line x1={2} y1={24} x2={12} y2={24} /><line x1={36} y1={24} x2={46} y2={24} />
            <circle cx={24} cy={24} r={1} fill="var(--ink)" stroke="none" />
            <path className="xcorner xc0" d="M15 19 v-4 h4" />
            <path className="xcorner xc1" d="M33 19 v-4 h-4" />
            <path className="xcorner xc2" d="M33 29 v4 h-4" />
            <path className="xcorner xc3" d="M15 29 v4 h4" />
          </g>
        </svg>
      </div>
      <div id="xco">X 0000 Y 0000</div>
    </div>
  );
}
