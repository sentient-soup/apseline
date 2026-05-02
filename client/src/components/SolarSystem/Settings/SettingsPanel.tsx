import { ThemePicker } from './ThemePicker';

interface Props { open: boolean; onClose: () => void }
export function SettingsPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 30, left: 30, zIndex: 20,
      width: 380, padding: 16,
      background: 'rgba(10,10,20,0.92)', border: '1px solid rgba(255,255,255,0.15)',
      fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.7)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(160,145,214,0.85)' }}>SETTINGS ▸ THEME</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>✕</button>
      </div>
      <ThemePicker />
    </div>
  );
}
