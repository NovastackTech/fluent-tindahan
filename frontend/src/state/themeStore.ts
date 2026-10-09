import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeState {
  themeMode: ThemeMode;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
}

export function getSystemDarkMode(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function computeIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return getSystemDarkMode();
}

export function getInitialMode(): ThemeMode {
  const savedMode = localStorage.getItem('fluent_tindahan_theme_mode') as ThemeMode | null;
  if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
    return savedMode;
  }
  const oldSaved = localStorage.getItem('fluent_tindahan_dark_theme');
  if (oldSaved === 'true') return 'dark';
  if (oldSaved === 'false') return 'light';
  return 'system';
}

const initialMode = getInitialMode();
const initialDark = computeIsDark(initialMode);

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: initialMode,
  isDarkMode: initialDark,
  setThemeMode: (mode: ThemeMode) => {
    const isDark = computeIsDark(mode);
    localStorage.setItem('fluent_tindahan_theme_mode', mode);
    localStorage.setItem('fluent_tindahan_dark_theme', isDark ? 'true' : 'false');
    set({ themeMode: mode, isDarkMode: isDark });
  },
  cycleThemeMode: () => {
    const current = get().themeMode;
    const next: ThemeMode = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    get().setThemeMode(next);
  },
  toggleDarkMode: () => {
    const currentDark = get().isDarkMode;
    get().setThemeMode(!currentDark ? 'dark' : 'light');
  },
  setDarkMode: (dark: boolean) => {
    get().setThemeMode(dark ? 'dark' : 'light');
  }
}));

export const initThemeMediaListener = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    const state = useThemeStore.getState();
    if (state.themeMode === 'system') {
      const isDark = typeof e.matches === 'boolean' ? e.matches : getSystemDarkMode();
      useThemeStore.setState({ isDarkMode: isDark });
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange as EventListener);
  } else if ((mediaQuery as any).addListener) {
    (mediaQuery as any).addListener(handleChange);
  }

  return () => {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', handleChange as EventListener);
    } else if ((mediaQuery as any).removeListener) {
      (mediaQuery as any).removeListener(handleChange);
    }
  };
};

initThemeMediaListener();
