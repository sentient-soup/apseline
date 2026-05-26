import { useState, useEffect, useRef } from 'react';
import type { LogEntry } from '@apseline/shared';

interface Props { open: boolean; onClose: () => void }

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info:  'rgba(255,255,255,0.35)',
  warn:  'var(--color-warn)',
  error: 'var(--color-alerts)',
};

const LEVEL_LABEL: Record<LogEntry['level'], string> = {
  info:  'INFO',
  warn:  'WARN',
  error: 'ERR ',
};

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ghostBtn: React.CSSProperties = {
  width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)', padding: 8, fontSize: 10, letterSpacing: 1.5,
  fontFamily: 'ui-monospace, Menlo, monospace', cursor: 'pointer', marginTop: 14,
};

export function LogsPanel({ open, onClose }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const load = async (initial = false) => {
      if (initial) setLoading(true);
      try {
        const r = await fetch('/api/logs');
        if (r.ok && !cancelled) {
          const data: LogEntry[] = await r.json();
          setEntries(data.slice().reverse()); // newest first
        }
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };

    load(true);
    const t = setInterval(() => load(false), 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [open]);

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

  const warnCount = entries.filter((e) => e.level === 'warn').length;
  const errCount  = entries.filter((e) => e.level === 'error').length;
  const subtitle  = [
    errCount  > 0 ? `${errCount} ERR`  : '',
    warnCount > 0 ? `${warnCount} WARN` : '',
  ].filter(Boolean).join(' · ') || `${entries.length} entries`;

  return (
    <div style={{
      position: 'fixed', top: 30, right: 30, zIndex: 10,
      fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.7)',
    }}>
      <div ref={frameRef} style={{
        width: 480, background: 'rgba(10,10,20,0.92)',
        border: '1px solid var(--color-cloudflare)', padding: 0,
      }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px 12px' }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--color-cloudflare)' }}>
            SYSTEM ▸ LOGS
          </div>
          <div style={{ fontSize: 18, color: '#fff', marginTop: 4, letterSpacing: 0.5 }}>
            {loading ? 'Loading…' : 'Server Log'}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              {!loading && subtitle}
            </span>
          </div>
        </div>

        {/* Log entries */}
        <div
          ref={bodyRef}
          onScroll={() => {
            const el = bodyRef.current;
            if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
          }}
          style={{ padding: '10px 0', fontSize: 10, lineHeight: 1.6, maxHeight: 440, overflowY: 'auto' }}
        >
          {entries.length === 0 && !loading && (
            <div style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.25)' }}>No log entries yet.</div>
          )}
          {entries.map((e, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '58px 38px 1fr',
              gap: '0 8px',
              padding: '1px 16px',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{fmtTime(e.ts)}</span>
              <span style={{ color: LEVEL_COLOR[e.level], letterSpacing: 0.5 }}>{LEVEL_LABEL[e.level]}</span>
              <span style={{ color: e.level === 'error' ? 'var(--color-alerts)' : e.level === 'warn' ? 'var(--color-warn)' : 'rgba(255,255,255,0.7)', wordBreak: 'break-word' }}>
                {e.message}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 0.8, marginBottom: 10 }}>
            <span>REFRESHES EVERY 5S</span>
            <span>{entries.length} / 500</span>
          </div>
          <button style={ghostBtn} onClick={onClose}>CLOSE</button>
        </div>

      </div>
    </div>
  );
}
