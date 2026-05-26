import { useState, useEffect, useRef } from 'react';
import { useServicesStore } from '../../../stores/servicesStore';
import { fmtRelTime } from '../../../lib/format';

interface Props { open: boolean; onClose: () => void }

function StatusRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)' }}>
      <span>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: connected ? 'rgba(80,220,140,0.85)' : 'rgba(255,255,255,0.2)',
        }} />
        <span style={{ color: connected ? 'rgba(80,220,140,0.85)' : 'rgba(255,255,255,0.3)' }}>
          {connected ? 'CONNECTED' : 'OFF'}
        </span>
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)' }}>
      <span>{label}</span><span style={{ color: '#fff' }}>{value}</span>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  flex: 1, background: 'color-mix(in srgb, rgba(255,255,255,0.5) 10%, transparent)',
  border: '1px solid rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.85)',
  padding: 8, fontSize: 10, letterSpacing: 1.5, fontFamily: 'ui-monospace, Menlo, monospace',
  cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)', padding: 8, fontSize: 10, letterSpacing: 1.5,
  fontFamily: 'ui-monospace, Menlo, monospace', cursor: 'pointer',
};

export function DiscoveryPanel({ open, onClose }: Props) {
  const discoveryStatus = useServicesStore((s) => s.discoveryStatus);
  const fetchDiscoveryStatus = useServicesStore((s) => s.fetchDiscoveryStatus);
  const refreshServices = useServicesStore((s) => s.refreshServices);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (open) fetchDiscoveryStatus();
  }, [open, fetchDiscoveryStatus]);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshServices();
      await fetchDiscoveryStatus();
    } finally {
      setRefreshing(false);
    }
  };

  const integrations = discoveryStatus ? [
    { label: 'Kubernetes', connected: discoveryStatus.kubernetes.connected },
    { label: 'Docker',     connected: discoveryStatus.docker.connected },
    { label: 'Cloudflare', connected: discoveryStatus.cloudflare?.connected ?? false },
    { label: 'Nginx',      connected: discoveryStatus.nginx?.connected ?? false },
    ...(discoveryStatus.cloud ?? []).map((c) => ({ label: `Cloud · ${c.name.toUpperCase()}`, connected: c.connected })),
  ] : [];

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div style={{
      position: 'fixed', top: 30, right: 30, zIndex: 10,
      fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.7)',
    }}>
      <div ref={frameRef} style={{
        width: 340, background: 'rgba(10,10,20,0.92)',
        border: '1px solid var(--color-gce)', padding: 0,
      }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px 12px' }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--color-gce)' }}>
            SYSTEM ▸ DISCOVERY
          </div>
          <div style={{ fontSize: 18, color: '#fff', marginTop: 4, letterSpacing: 0.5 }}>
            Integrations
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              {discoveryStatus ? `${connectedCount} / ${integrations.length} active` : '—'}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px', fontSize: 11, lineHeight: 1.7 }}>
          {!discoveryStatus ? (
            <div style={{ color: 'rgba(255,255,255,0.25)' }}>Loading…</div>
          ) : (
            <>
              {integrations.map((i) => (
                <StatusRow key={i.label} label={i.label} connected={i.connected} />
              ))}

              <div style={{ margin: '10px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }} />

              <Row label="LAST RUN"  value={fmtRelTime(discoveryStatus.lastDiscovery ?? undefined)} />
              <Row label="SERVICES"  value={String(discoveryStatus.cachedServiceCount)} />
            </>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button style={primaryBtn} onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? 'REFRESHING…' : '↺ REFRESH'}
            </button>
            <button style={ghostBtn} onClick={onClose}>CLOSE</button>
          </div>
        </div>

      </div>
    </div>
  );
}
