import { useServicesStore } from '../../stores/servicesStore';
import { fmtPct, fmtUptime, fmtLatency, fmtRelTime, fmtCount } from '../../lib/format';
import type { Service, HealthState, PlanetMetrics } from '@apseline/shared';
import './pulse.css';

type Planet = 'perihelion' | 'aphelion';

const PLANETS: Planet[] = ['perihelion', 'aphelion'];
const PLANET_VAR: Record<Planet, string> = {
  perihelion: 'var(--perihelion)',
  aphelion: 'var(--aphelion)',
};

// "Alerting" = health is actively bad. unknown / up / no-check all read as fine.
const isAlerting = (s: HealthState | undefined) => s === 'down' || s === 'degraded';

export function Pulse() {
  const services = useServicesStore((s) => s.services);
  const metrics = useServicesStore((s) => s.metrics);
  const health = useServicesStore((s) => s.health);

  const stateOf = (svc: Service): HealthState =>
    health[svc.name]?.state ?? 'unknown';

  // ── Global rollup ────────────────────────────────────────────────
  const machinesUp = PLANETS.reduce((n, p) => n + (metrics?.[p]?.aggregate.machinesUp ?? 0), 0);
  const servicesUp = services.filter((s) => !isAlerting(stateOf(s))).length;
  const alerts = services.filter((s) => isAlerting(stateOf(s)));
  const downCount = alerts.filter((s) => stateOf(s) === 'down').length;
  const healthyPct = services.length ? Math.round((servicesUp / services.length) * 100) : 100;

  let verdict: string, verdictColor: string, verdictSub: string;
  if (downCount > 0) {
    verdict = 'SYSTEMS DEGRADED';
    verdictColor = 'var(--alert)';
    verdictSub = `PULSE ▸ ${downCount} SERVICE${downCount > 1 ? 'S' : ''} DOWN ▸ ACTION NEEDED`;
  } else if (alerts.length > 0) {
    verdict = 'ALL SYSTEMS NOMINAL';
    verdictColor = 'var(--ok)';
    verdictSub = `PULSE ▸ ${alerts.length} SERVICE${alerts.length > 1 ? 'S' : ''} DEGRADED ▸ NON-CRITICAL`;
  } else {
    verdict = 'ALL SYSTEMS NOMINAL';
    verdictColor = 'var(--ok)';
    verdictSub = 'PULSE ▸ ALL CLEAR';
  }

  const quick = services.slice(0, 7);

  return (
    <div className="pulse-root">
      <div className="pulse-wrap">
        <div className="pulse-brand">
          <h1>APSELINE<span className="dot">_</span></h1>
          <span className="microlabel">// ORBITAL ▸ MONITOR ▸ PULSE_CARDS</span>
        </div>

        {/* PULSE header */}
        <div className="card pulse">
          <div className="verdict-block">
            <div className="verdict-row">
              <span className="bigdot" style={{ background: verdictColor, color: verdictColor }} />
              <span className="verdict">{verdict}</span>
            </div>
            <div className="sub">{verdictSub}</div>
          </div>
          <div className="divider" />
          <div className="chips">
            <Chip num={machinesUp} numColor="var(--ok)" label="Machines Up" />
            <Chip num={servicesUp} numColor="var(--ok)" label="Services Up" />
            <Chip num={alerts.length} numColor={alerts.length ? 'var(--warn)' : 'var(--ok)'} label="Active Alerts" />
            <Chip num={`${healthyPct}%`} numColor="var(--text)" label="Healthy" />
          </div>
        </div>

        {quick.length > 0 && (
          <>
            <div className="quick-label">QUICK LAUNCH ▸ TOP SERVICES</div>
            <div className="quick">
              {quick.map((s) => (
                <a key={s.name} className="qbtn" href={s.url} target="_blank" rel="noreferrer">
                  <span className="qd" style={dotStyle(stateOf(s))} />
                  {s.name}
                </a>
              ))}
            </div>
          </>
        )}

        <div className="pulse-grid">
          {PLANETS.map((p) => (
            <PlanetCard
              key={p}
              planet={p}
              pm={metrics?.[p]}
              services={services.filter((s) => s.infrastructure === p)}
              stateOf={stateOf}
            />
          ))}

          <AlertsCard alerts={alerts} stateOf={stateOf} health={health} />

          <CloudflareCard />
        </div>

        <div className="footer-note">APSELINE ▸ PULSE_CARDS ▸ CYBER VARIANT</div>
      </div>
    </div>
  );
}

function Chip({ num, numColor, label }: { num: number | string; numColor: string; label: string }) {
  return (
    <div className="chip">
      <span className="num" style={{ color: numColor }}>{num}</span>
      <span className="lbl">{label}</span>
    </div>
  );
}

function dotStyle(state: HealthState): React.CSSProperties {
  if (state === 'down') return { background: 'var(--alert)', color: 'var(--alert)' };
  if (state === 'degraded') return { background: 'var(--warn)', color: 'var(--warn)' };
  return { background: 'var(--ok)', color: 'var(--ok)' };
}

function PlanetCard({
  planet, pm, services, stateOf,
}: {
  planet: Planet;
  pm: PlanetMetrics | undefined;
  services: Service[];
  stateOf: (s: Service) => HealthState;
}) {
  const color = PLANET_VAR[planet];
  const agg = pm?.aggregate;
  const machines = pm?.machines ?? [];
  const svcUp = services.filter((s) => !isAlerting(stateOf(s))).length;
  const name = planet.toUpperCase();

  return (
    <details className="card exp" open>
      <summary className="summary">
        <div className="planet-head">
          <span className="planet-accent" style={{ background: color, boxShadow: `0 0 16px ${color}` }} />
          <div>
            <div className="planet-name" style={{ color }}>{name}</div>
            <div className="planet-meta">
              {name} ▸ {machines.length} NODE{machines.length === 1 ? '' : 'S'} ▸ {services.length} SERVICE{services.length === 1 ? '' : 'S'}
            </div>
          </div>
          <div className="chevron">⌄</div>
        </div>
        <div className="bars">
          <Bar label="CPU" pct={agg?.cpuPct} color={color} />
          <Bar label="MEM" pct={agg?.memPct} color={color} />
          <Bar label="DISK" pct={agg?.diskPct} color={color} />
        </div>
        <div className="counts">
          <CountPill
            value={`${agg?.machinesUp ?? 0} / ${agg?.machinesTotal ?? machines.length}`}
            color={(agg?.machinesUp ?? 0) < (agg?.machinesTotal ?? 0) ? 'var(--warn)' : 'var(--ok)'}
            label="Machines Up"
          />
          <CountPill
            value={`${svcUp} / ${services.length}`}
            color={svcUp < services.length ? 'var(--warn)' : 'var(--ok)'}
            label="Services Up"
          />
        </div>
      </summary>
      <div className="detail">
        <div className="detail-inner">
          <div className="detail-pad">
            <div className="section-label">NODES ▸ {name}</div>
            {machines.length === 0 && <div className="empty-note">No telemetry for this cluster.</div>}
            {machines.map((m) => (
              <div className="node" key={m.id}>
                <span className="node-name">{m.id || m.host}</span>
                <span className="node-tag">{(m.role ?? 'node').toUpperCase()}</span>
                <div className="node-stats">
                  <NStat v={fmtPct(m.cpuPct)} l="CPU" />
                  <NStat v={fmtPct(m.memPct)} l="MEM" />
                  <NStat v={fmtPct(m.diskPct)} l="DISK" />
                  <NStat v={fmtUptime(m.uptimeSeconds)} l="UP" />
                </div>
              </div>
            ))}

            <div className="section-label" style={{ marginTop: 20 }}>LAUNCH BOARD ▸ CLICK TO OPEN</div>
            <div className="launchgrid">
              {services.map((s) => {
                const st = stateOf(s);
                const cls = st === 'down' ? 'ld down' : st === 'degraded' ? 'ld deg' : 'ld';
                const cat = st === 'degraded' ? `${s.category ?? ''} · Degraded`
                  : st === 'down' ? `${s.category ?? ''} · Down`
                  : s.category ?? '';
                return (
                  <a className="launch" key={s.name} href={s.url} target="_blank" rel="noreferrer">
                    <span className={cls} />
                    <div>
                      <div className="lname">{s.name}</div>
                      <div className="lcat">{cat || '—'}</div>
                    </div>
                    <span className="arr">↗</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number | undefined; color: string }) {
  const w = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct as number)) : 0;
  return (
    <div className="bar-row">
      <span className="bar-lbl">{label}</span>
      <div className="track"><div className="fill" style={{ width: `${w}%`, background: color }} /></div>
      <span className="bar-val">{fmtPct(pct)}</span>
    </div>
  );
}

function CountPill({ value, color, label }: { value: string; color: string; label: string }) {
  return (
    <div className="count-pill">
      <span className="cn" style={{ color }}>{value}</span>
      <span className="cl">{label}</span>
    </div>
  );
}

function NStat({ v, l }: { v: string; l: string }) {
  return <div className="nstat"><div className="nv">{v}</div><div className="nl">{l}</div></div>;
}

function AlertsCard({
  alerts, stateOf, health,
}: {
  alerts: Service[];
  stateOf: (s: Service) => HealthState;
  health: ReturnType<typeof useServicesStore.getState>['health'];
}) {
  const worst = alerts.some((s) => stateOf(s) === 'down') ? 'CRITICAL' : alerts.length ? 'WARN' : 'CLEAR';
  return (
    <details className="card exp">
      <summary className="summary">
        <div className="alert-head">
          <div className="alert-icon">▲</div>
          <div>
            <div className="card-title">{alerts.length} Alert{alerts.length === 1 ? '' : 's'} · {alerts.length ? 'Degraded' : 'Clear'}</div>
            <div className="card-sub">ALERTS ▸ WORST: {worst} ▸ {alerts.some((s) => stateOf(s) === 'down') ? 'CRITICAL' : 'NON-CRITICAL'}</div>
          </div>
          <div className="chevron" style={{ marginLeft: 'auto' }}>⌄</div>
        </div>
      </summary>
      <div className="detail">
        <div className="detail-inner">
          <div className="detail-pad">
            {alerts.length === 0 && <div className="empty-note">No active alerts. All health checks passing.</div>}
            {alerts.map((s) => {
              const h = health[s.name];
              const down = stateOf(s) === 'down';
              return (
                <div className={`alert-item${down ? ' down' : ''}`} key={s.name}>
                  <div className="ai-top">
                    <span className={`ai-dot${down ? ' down' : ''}`} />
                    <span className="ai-name">{s.name}</span>
                    <span className={`ai-badge${down ? ' down' : ''}`}>{down ? 'Down' : 'Degraded'}</span>
                  </div>
                  <div className="ai-grid">
                    <div className="ai-cell"><div className="av bad">{fmtLatency(h?.latencyMs)}</div><div className="al">Latency</div></div>
                    <div className="ai-cell"><div className="av">{fmtRelTime(h?.lastChecked)}</div><div className="al">Last Check</div></div>
                    <div className="ai-cell"><div className="av">{s.category ?? s.infrastructure}</div><div className="al">Source</div></div>
                  </div>
                  {h?.error && <div className="ai-err">ERR ▸ <b>{h.error}</b></div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
}

function CloudflareCard() {
  const cf = useServicesStore((s) => s.metrics?.cloudflare);
  if (!cf || cf.zones.length === 0) return null;

  const threats = cf.zones.reduce((n, z) => n + (z.threats24h ?? 0), 0);
  return (
    <details className="card exp">
      <summary className="summary">
        <div className="cf-head">
          <div className="cf-icon">☁</div>
          <div>
            <div className="card-title" style={{ color: 'var(--cloudflare)' }}>Cloudflare Edge</div>
            <div className="card-sub">EDGE ▸ 24H WINDOW ▸ {cf.zones.length} ZONES</div>
          </div>
          <div className="chevron" style={{ marginLeft: 'auto' }}>⌄</div>
        </div>
        <div className="cf-stats">
          <div className="cf-stat"><div className="cv">{fmtCount(cf.totalRequests24h)}</div><div className="cl">Requests 24h</div></div>
          <div className="cf-stat"><div className="cv">{fmtPct((cf.averageCacheHitRatio ?? 0) * 100)}</div><div className="cl">Cache Hit</div></div>
          <div className="cf-stat"><div className="cv" style={{ color: threats ? 'var(--warn)' : 'var(--ok)' }}>{threats}</div><div className="cl">Threats</div></div>
        </div>
      </summary>
      <div className="detail">
        <div className="detail-inner">
          <div className="detail-pad">
            <div className="section-label">PER-ZONE ▸ REQUESTS / CACHE HIT</div>
            {cf.zones.map((z) => (
              <div className="zone" key={z.zone}>
                <span className="zone-name">{z.zone}</span>
                <span className="zone-req">{fmtCount(z.requests24h)}</span>
                <span className="zone-hit">{fmtPct((z.cacheHitRatio ?? 0) * 100)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
