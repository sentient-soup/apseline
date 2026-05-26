import { useEffect, useRef } from 'react';
import type { Service } from '@apseline/shared';
import { useViewStore } from '../../../stores/viewStore';
import { useServicesStore } from '../../../stores/servicesStore';
import { findNode } from '../layout';
import { fmtLatency, fmtRelTime } from '../../../lib/format';

interface ServiceModalProps {
  nodeId: string;
  serviceId: string;
  services: Service[];
}

function hostnameOf(url: string) { try { return new URL(url).host; } catch { return url; } }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)' }}>
      <span>{label}</span><span style={{ color: '#fff' }}>{value}</span>
    </div>
  );
}

const modalShellStyle: React.CSSProperties = {
  position: 'fixed', top: 30, right: 30, zIndex: 10,
  fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.7)',
};
const modalFrameStyle: React.CSSProperties = {
  width: 340, background: 'rgba(10,10,20,0.92)', border: '1px solid', padding: 0,
};
const modalHeaderStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px 12px',
};
const modalBodyStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 11, lineHeight: 1.7 };
const primaryBtn = (colorVar: string): React.CSSProperties => ({
  flex: 1, background: `color-mix(in srgb, var(--${colorVar}) 15%, transparent)`,
  border: `1px solid var(--${colorVar})`, color: `var(--${colorVar})`,
  padding: 8, fontSize: 10, letterSpacing: 1.5, fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none',
});
const ghostBtn: React.CSSProperties = {
  flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)', padding: 8, fontSize: 10, letterSpacing: 1.5, fontFamily: 'inherit',
};

export function ServiceModal({ nodeId, serviceId, services }: ServiceModalProps) {
  const closeService = useViewStore((s) => s.closeService);
  const healthMap = useServicesStore((s) => s.health);
  const node = findNode(nodeId);
  const service = services.find((s) => s.name === serviceId);
  const health = service ? healthMap[service.name] : undefined;
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeService(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeService]);

  // Click outside the modal closes it. Defer attachment so the click that
  // opened the modal doesn't immediately close it.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    const t = setTimeout(() => {
      const onClick = (e: MouseEvent) => {
        if (frameRef.current && !frameRef.current.contains(e.target as Node)) {
          closeService();
        }
      };
      document.addEventListener('mousedown', onClick);
      cleanup = () => document.removeEventListener('mousedown', onClick);
    }, 0);
    return () => { clearTimeout(t); cleanup?.(); };
  }, [closeService, serviceId]);

  if (!node || !service) return null;

  return (
    <div style={modalShellStyle}>
      <div ref={frameRef} style={{ ...modalFrameStyle, borderColor: `var(--${node.colorVar})` }}>
        <div style={modalHeaderStyle}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: `var(--${node.colorVar})` }}>
            {node.label} ▸ SVC ▸ {service.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 18, color: '#fff', marginTop: 4, letterSpacing: 0.5 }}>
            {service.name}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              {service.category ?? '—'} · {hostnameOf(service.url)}
            </span>
          </div>
        </div>
        <div style={modalBodyStyle}>
          <Row label="STATUS" value={(health?.state ?? service.status ?? 'unknown').toUpperCase()} />
          <Row label="LATENCY" value={fmtLatency(health?.latencyMs)} />
          <Row label="HTTP" value={health?.statusCode ? String(health.statusCode) : '—'} />
          <Row label="LAST CHECK" value={fmtRelTime(health?.lastChecked)} />
          <Row label="HOST" value={hostnameOf(service.url)} />
          <Row label="SOURCE" value={service.source ?? 'manual'} />
          <Row label="CATEGORY" value={service.category ?? '—'} />
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <a href={service.url} target="_blank" rel="noreferrer" style={primaryBtn(node.colorVar)}>▸ OPEN</a>
            <button style={ghostBtn} onClick={closeService}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}
