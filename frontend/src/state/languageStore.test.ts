import { describe, it, expect, beforeEach } from 'vitest';
import { useLanguageStore, useTranslation } from './languageStore';
import { renderHook, act } from '@testing-library/react';

describe('languageStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLanguageStore.setState({ language: 'en' });
  });

  it('initializes with default language en', () => {
    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('sets language to tl and persists to localStorage', () => {
    useLanguageStore.getState().setLanguage('tl');

    expect(useLanguageStore.getState().language).toBe('tl');
    expect(localStorage.getItem('fluent_tindahan_language')).toBe('tl');
  });

  it('toggles language between en and tl and updates localStorage', () => {
    useLanguageStore.getState().toggleLanguage();
    expect(useLanguageStore.getState().language).toBe('tl');
    expect(localStorage.getItem('fluent_tindahan_language')).toBe('tl');

    useLanguageStore.getState().toggleLanguage();
    expect(useLanguageStore.getState().language).toBe('en');
    expect(localStorage.getItem('fluent_tindahan_language')).toBe('en');
  });

  it('useTranslation hook returns corresponding translation object and controls', () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.language).toBe('en');
    expect(result.current.t.nav.pos).toBe('Store (POS)');

    act(() => {
      result.current.setLanguage('tl');
    });

    expect(result.current.language).toBe('tl');
    expect(result.current.t.nav.pos).toBe('Benta (POS)');

    act(() => {
      result.current.toggleLanguage();
    });

    expect(result.current.language).toBe('en');
  });
});
