import { THEMES, type ThemeId } from '../../../lib/palette';
import { useThemeStore } from '../../../stores/themeStore';

export function ThemePicker() {
  const { themeId, setTheme } = useThemeStore();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {(Object.keys(THEMES) as ThemeId[]).map((id) => {
        const t = THEMES[id];
        const active = id === themeId;
        return (
          <button key={id} onClick={() => setTheme(id)}
            style={{
              background: t.bg, border: active ? `1px solid ${t.perihelion}` : '1px solid rgba(255,255,255,0.1)',
              padding: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'ui-monospace, Menlo, monospace',
              color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 1,
            }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {[t.perihelion, t.aphelion, t.cloudflare, t.gce, t.warn, t.alerts].map((c, i) => (
                <span key={i} style={{ width: 10, height: 10, background: c, display: 'inline-block' }} />
              ))}
            </div>
            <div>{id}</div>
          </button>
        );
      })}
    </div>
  );
}
