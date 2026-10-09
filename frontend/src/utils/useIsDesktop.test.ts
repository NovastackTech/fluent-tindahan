import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsDesktop } from './useIsDesktop';

describe('useIsDesktop', () => {
  it('returns true when window is wide and responds to media query changes', () => {
    let changeHandler: ((e: any) => void) | null = null;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);

    if (changeHandler) {
      act(() => {
        changeHandler!({ matches: false } as any);
      });
      expect(result.current).toBe(false);
    }
  });
});
