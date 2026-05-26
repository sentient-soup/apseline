import { useEffect, useRef } from 'react';
import { useServicesStore } from '../../../stores/servicesStore';
import { fmtLatency, fmtRelTime } from '../../../lib/format';

interface Props { open: boolean; onClose: () => void }

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)' }}>
      <span>{label}</span>
      <span style={{ color: valueColor ?? '#fff' }}>{value}</span>
    </div>
  );
}

const STATE_COLOR: Record<string, string> = {
  down:    'var(--color-alerts)',
  degraded: 'var(--color-warn)',
};

const ghostBtn: React.CSSProperties = {
  width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)', padding: 8, fontSize: 10, letterSpacing: 1.5,
  fontFamily: 'ui-monospace, Menlo, monospace', cursor: 'pointer', marginTop: 14,
};

export function AlertsPanel({ open, onClose }: Props) {
  const health = useServicesStore((s) => s.health);
  const services = useServicesStore((s) => s.services);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cleanup: (() => void) | null = null;
    const t = setTimeout(() => {
      const onClick = (e: MouseEvent) => {
        if (frameRef.current && !frameRef.current.contains(e.target as Node)) onClose();
      };
      document.addEventListener('mousedown', onClick);
      cleanup = () => document.removeEventListener('mousedown', onClick);
    }, 0);
    return () => { clearTimeout(t); cleanup?.(); };
  }, [open, onClose]);

  if (!open) return null;

  const alerts = Object.entries(health)
    .filter(([, h]) => h.state === 'down' || h.state === 'degraded')
    .sort(([, a], [, b]) => (a.state === b.state ? 0 : a.state === 'down' ? -1 : 1));

  const svcByName = new Map(services.map((s) => [s.name, s]));

  const downCount = alerts.filter(([, h]) => h.state === 'down').length;
  const degradedCount = alerts.filter(([, h]) => h.state === 'degraded').length;
  const summaryParts = [
    downCount > 0 ? `${downCount} DOWN` : '',
    degradedCount > 0 ? `${degradedCount} DEGRADED` : '',
  ].filter(Boolean).join(' · ') || 'ALL HEALTHY';

  return (
    <div style={{
      position: 'fixed', top: 30, right: 30, zIndex: 10,
      fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.7)',
    }}>
      <div ref={frameRef} style={{
        width: 340, background: 'rgba(10,10,20,0.92)',
        border: '1px solid var(--color-alerts)', padding: 0,
      }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px 12px' }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--color-alerts)' }}>
            SYSTEM ▸ ALERTS
          </div>
          <div style={{ fontSize: 18, color: '#fff', marginTop: 4, letterSpacing: 0.5 }}>
            {alerts.length > 0 ? `${alerts.length} Alert${alerts.length !== 1 ? 's' : ''}` : 'All Clear'}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              {summaryParts}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px', fontSize: 11, lineHeight: 1.7, maxHeight: 480, overflowY: 'auto' }}>
          {alerts.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '12px 0' }}>
              No active alerts.
            </div>
          ) : (
            alerts.map(([name, h], i) => {
              const svc = svcByName.get(name);
              return (
                <div key={name} style={i > 0 ? { marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' } : {}}>
                  {/* Service name mini-header */}
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: STATE_COLOR[h.state] ?? 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                    {h.state.toUpperCase()} ▸ {name.toUpperCase()}
                  </div>
                  <Row label="STATUS"     value={h.state.toUpperCase()}               valueColor={STATE_COLOR[h.state]} />
                  <Row label="HTTP"       value={h.statusCode ? String(h.statusCode) : '—'} />
                  <Row label="LATENCY"    value={fmtLatency(h.latencyMs)} />
                  <Row label="LAST CHECK" value={fmtRelTime(h.lastChecked)} />
                  {svc && <Row label="HOST" value={(() => { try { return new URL(svc.url).host; } catch { return svc.url; } })()} />}
                  {h.error && (
                    <div style={{ marginTop: 4, fontSize: 9, color: 'var(--color-alerts)', opacity: 0.75 }}>
                      {h.error}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <button style={ghostBtn} onClick={onClose}>CLOSE</button>
        </div>

      </div>
    </div>
  );
}
