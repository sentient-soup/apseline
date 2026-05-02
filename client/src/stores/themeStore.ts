import { create } from 'zustand';
import { applyTheme, THEMES, type ThemeId } from '../lib/palette';

const STORAGE_KEY = 'apseline.theme';

interface ThemeStore {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  initFromStorage: () => void;
}

function isValidThemeId(v: string | null): v is ThemeId {
  return !!v && v in THEMES;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  themeId: 'nebula-warm',
  setTheme: (id) => {
    applyTheme(id);
    localStorage.setItem(STORAGE_KEY, id);
    set({ themeId: id });
  },
  initFromStorage: () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const id: ThemeId = isValidThemeId(saved) ? saved : 'nebula-warm';
    applyTheme(id);
    set({ themeId: id });
  },
}));
