import { describe, it, expect, beforeEach } from 'vitest';
import { usePosSettingsStore, POS_SETTINGS_STORAGE_KEY } from './posSettingsStore';

describe('posSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePosSettingsStore.setState({ stockValidationPolicy: 'warn' });
  });

  it('defaults to warn policy', () => {
    expect(usePosSettingsStore.getState().stockValidationPolicy).toBe('warn');
  });

  it('allows updating policy to block and saves to localStorage', () => {
    usePosSettingsStore.getState().setStockValidationPolicy('block');
    expect(usePosSettingsStore.getState().stockValidationPolicy).toBe('block');
    expect(localStorage.getItem(POS_SETTINGS_STORAGE_KEY)).toBe('block');
  });

  it('allows updating policy back to warn', () => {
    usePosSettingsStore.getState().setStockValidationPolicy('block');
    usePosSettingsStore.getState().setStockValidationPolicy('warn');
    expect(usePosSettingsStore.getState().stockValidationPolicy).toBe('warn');
    expect(localStorage.getItem(POS_SETTINGS_STORAGE_KEY)).toBe('warn');
  });
});
