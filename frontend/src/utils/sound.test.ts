import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playScanBeep } from './sound';

describe('playScanBeep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('synthesizes barcode beep via Web Audio API and calls navigator.vibrate', () => {
    expect(() => playScanBeep()).not.toThrow();
    expect(navigator.vibrate).toHaveBeenCalledWith(60);
  });

  it('gracefully handles missing AudioContext without error', () => {
    const originalAudioContext = window.AudioContext;
    (window as any).AudioContext = undefined;
    (window as any).webkitAudioContext = undefined;

    expect(() => playScanBeep()).not.toThrow();

    (window as any).AudioContext = originalAudioContext;
  });

  it('gracefully handles vibration exception without crashing', () => {
    (navigator as any).vibrate = vi.fn().mockImplementation(() => {
      throw new Error('Vibration permission denied');
    });

    expect(() => playScanBeep()).not.toThrow();
  });
});
