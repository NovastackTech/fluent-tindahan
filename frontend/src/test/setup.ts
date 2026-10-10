import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi, beforeEach } from 'vitest';

// Provide storage mocks for Vitest jsdom environment
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; }
  };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true
});

// Provide BroadcastChannel mock for multi-tab coordination in jsdom
export class MockBroadcastChannel {
  name: string;
  static channels: Map<string, Set<MockBroadcastChannel>> = new Map();
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(data: any) {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== this) {
        const event = new MessageEvent('message', { data });
        peer.onmessage?.(event);
        peer.listeners.get('message')?.forEach((listener) => listener(event));
      }
    }
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
    this.listeners.clear();
  }

  static resetAll() {
    MockBroadcastChannel.channels.clear();
  }
}

(window as any).BroadcastChannel = MockBroadcastChannel;
(globalThis as any).BroadcastChannel = MockBroadcastChannel;

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

// Clear storages and mocks before each test
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  MockBroadcastChannel.resetAll();
  vi.clearAllMocks();
});


