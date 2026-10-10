import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi, beforeEach } from 'vitest';

// Mock matchMedia for FluentUI and desktop responsive checks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Web Audio API
class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }
}

(window as any).AudioContext = MockAudioContext;
(window as any).webkitAudioContext = MockAudioContext;

// Mock navigator.vibrate
if (typeof navigator !== 'undefined') {
  (navigator as any).vibrate = vi.fn().mockReturnValue(true);
}

// Mock ResizeObserver for FluentUI components like MessageBar
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(window as any).ResizeObserver = MockResizeObserver;
(globalThis as any).ResizeObserver = MockResizeObserver;

// Mock virtual:pwa-register for Vitest
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn().mockImplementation((_options) => {
    return vi.fn().mockResolvedValue(undefined);
  })
}));

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
