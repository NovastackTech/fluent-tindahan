import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore, computeIsDark, getSystemDarkMode, initThemeMediaListener, getInitialMode } from './themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ themeMode: 'light', isDarkMode: false });
  });

  it('initializes with default mode', () => {
    expect(useThemeStore.getState().themeMode).toBe('light');
    expect(useThemeStore.getState().isDarkMode).toBe(false);
  });

  it('sets theme mode to light, dark, and system', () => {
    useThemeStore.getState().setThemeMode('dark');
    expect(useThemeStore.getState().themeMode).toBe('dark');
    expect(useThemeStore.getState().isDarkMode).toBe(true);
    expect(localStorage.getItem('fluent_tindahan_theme_mode')).toBe('dark');
    expect(localStorage.getItem('fluent_tindahan_dark_theme')).toBe('true');

    useThemeStore.getState().setThemeMode('light');
    expect(useThemeStore.getState().themeMode).toBe('light');
    expect(useThemeStore.getState().isDarkMode).toBe(false);
    expect(localStorage.getItem('fluent_tindahan_theme_mode')).toBe('light');
    expect(localStorage.getItem('fluent_tindahan_dark_theme')).toBe('false');

    useThemeStore.getState().setThemeMode('system');
    expect(useThemeStore.getState().themeMode).toBe('system');
    expect(localStorage.getItem('fluent_tindahan_theme_mode')).toBe('system');
  });

  it('cycles through theme modes: light -> dark -> system -> light', () => {
    useThemeStore.getState().setThemeMode('light');

    useThemeStore.getState().cycleThemeMode();
    expect(useThemeStore.getState().themeMode).toBe('dark');

    useThemeStore.getState().cycleThemeMode();
    expect(useThemeStore.getState().themeMode).toBe('system');

    useThemeStore.getState().cycleThemeMode();
    expect(useThemeStore.getState().themeMode).toBe('light');
  });

  it('toggles dark mode for backward compatibility', () => {
    useThemeStore.getState().toggleDarkMode();
    expect(useThemeStore.getState().isDarkMode).toBe(true);
    expect(localStorage.getItem('fluent_tindahan_dark_theme')).toBe('true');

    useThemeStore.getState().toggleDarkMode();
    expect(useThemeStore.getState().isDarkMode).toBe(false);
    expect(localStorage.getItem('fluent_tindahan_dark_theme')).toBe('false');
  });

  it('sets dark mode directly for backward compatibility', () => {
    useThemeStore.getState().setDarkMode(true);
    expect(useThemeStore.getState().isDarkMode).toBe(true);
    expect(localStorage.getItem('fluent_tindahan_dark_theme')).toBe('true');

    useThemeStore.getState().setDarkMode(false);
    expect(useThemeStore.getState().isDarkMode).toBe(false);
    expect(localStorage.getItem('fluent_tindahan_dark_theme')).toBe('false');
  });

  it('correctly computes isDark based on mode and matchMedia', () => {
    expect(computeIsDark('dark')).toBe(true);
    expect(computeIsDark('light')).toBe(false);

    // Mock matchMedia returning true
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getSystemDarkMode()).toBe(true);
    expect(computeIsDark('system')).toBe(true);

    window.matchMedia = originalMatchMedia;
  });

  it('handles media listener events and responds when in system mode', () => {
    let changeHandler: ((e: any) => void) | undefined;
    const addEventListenerMock = vi.fn((event, handler) => {
      if (event === 'change') changeHandler = handler;
    });
    const removeEventListenerMock = vi.fn();

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));

    const cleanup = initThemeMediaListener();
    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));

    // When themeMode is 'system', media change should update isDarkMode
    useThemeStore.setState({ themeMode: 'system', isDarkMode: false });
    if (changeHandler) {
      changeHandler({ matches: true });
    }
    expect(useThemeStore.getState().isDarkMode).toBe(true);

    if (changeHandler) {
      changeHandler({ matches: false });
    }
    expect(useThemeStore.getState().isDarkMode).toBe(false);

    // When themeMode is 'dark', media change should NOT alter isDarkMode
    useThemeStore.setState({ themeMode: 'dark', isDarkMode: true });
    if (changeHandler) {
      changeHandler({ matches: false });
    }
    expect(useThemeStore.getState().isDarkMode).toBe(true);

    // Test cleanup
    cleanup?.();
    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));

    window.matchMedia = originalMatchMedia;
  });

  it('supports legacy addListener and removeListener fallback', () => {
    let legacyHandler: ((e: any) => void) | undefined;
    const addListenerMock = vi.fn((handler) => {
      legacyHandler = handler;
    });
    const removeListenerMock = vi.fn();

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      addListener: addListenerMock,
      removeListener: removeListenerMock,
    }));

    const cleanup = initThemeMediaListener();
    expect(addListenerMock).toHaveBeenCalled();

    useThemeStore.setState({ themeMode: 'system', isDarkMode: false });
    if (legacyHandler) {
      legacyHandler({ matches: true });
    }
    expect(useThemeStore.getState().isDarkMode).toBe(true);

    cleanup?.();
    expect(removeListenerMock).toHaveBeenCalled();

    window.matchMedia = originalMatchMedia;
  });

  it('determines initial mode from localStorage or legacy settings', () => {
    localStorage.clear();
    expect(getInitialMode()).toBe('system');

    localStorage.setItem('fluent_tindahan_theme_mode', 'dark');
    expect(getInitialMode()).toBe('dark');

    localStorage.setItem('fluent_tindahan_theme_mode', 'light');
    expect(getInitialMode()).toBe('light');

    localStorage.clear();
    localStorage.setItem('fluent_tindahan_dark_theme', 'true');
    expect(getInitialMode()).toBe('dark');

    localStorage.setItem('fluent_tindahan_dark_theme', 'false');
    expect(getInitialMode()).toBe('light');
  });

  it('safely handles getSystemDarkMode when matchMedia is missing', () => {
    const originalMatchMedia = window.matchMedia;
    (window as any).matchMedia = undefined;

    expect(getSystemDarkMode()).toBe(false);

    window.matchMedia = originalMatchMedia;
  });
});
