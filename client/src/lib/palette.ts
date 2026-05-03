export type ThemeId = 'nebula-warm' | 'nightfall' | 'nebula-ink' | 'dusty-plum' | 'blueprint' | 'void';

export interface Theme {
  bg: string;
  perihelion: string;
  aphelion: string;
  cloudflare: string;
  gce: string;
  star: string;
  warn: string;
  alerts: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  'nebula-warm': { bg: '#13121A', perihelion: '#DA79B0', aphelion: '#A091D6', cloudflare: '#7BA5CC', gce: '#7DC0A4', star: '#DCC676', warn: '#D4B97A', alerts: '#D48989' },
  'nightfall':   { bg: '#0F0F1E', perihelion: '#DA79B0', aphelion: '#8B95E0', cloudflare: '#6FA8DC', gce: '#7DBDC0', star: '#D2BD72', warn: '#C7B27A', alerts: '#C88A95' },
  'nebula-ink':  { bg: '#100E1A', perihelion: '#DC7AB6', aphelion: '#B093E0', cloudflare: '#82A8D6', gce: '#88C4A8', star: '#DEC97A', warn: '#D6BD80', alerts: '#D88A92' },
  'dusty-plum':  { bg: '#18121C', perihelion: '#E18AB6', aphelion: '#B098D8', cloudflare: '#8AABCC', gce: '#93C5A8', star: '#E2CC7C', warn: '#DCBE82', alerts: '#DC8E8E' },
  'blueprint':   { bg: '#0E0F14', perihelion: '#C97DA8', aphelion: '#968FCE', cloudflare: '#7AA3CC', gce: '#7CBDA0', star: '#CFBC73', warn: '#CBB077', alerts: '#CC8585' },
  'void':        { bg: '#0A0A14', perihelion: '#E07AB2', aphelion: '#A98FE2', cloudflare: '#7AA8D8', gce: '#7AC4A4', star: '#E0CB78', warn: '#DCBC78', alerts: '#DC8585' },
};

export function applyTheme(id: ThemeId): void {
  const t = THEMES[id];
  const root = document.documentElement;
  root.style.setProperty('--color-bg', t.bg);
  root.style.setProperty('--color-perihelion', t.perihelion);
  root.style.setProperty('--color-aphelion', t.aphelion);
  root.style.setProperty('--color-cloudflare', t.cloudflare);
  root.style.setProperty('--color-gce', t.gce);
  root.style.setProperty('--color-star', t.star);
  root.style.setProperty('--color-warn', t.warn);
  root.style.setProperty('--color-alerts', t.alerts);
}
