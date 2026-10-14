import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientUuid } from './uuid';

describe('createClientUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the crypto randomUUID implementation when available', () => {
    const randomUUID = vi.fn(() => '12345678-1234-4234-8234-123456789abc');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createClientUuid()).toBe('12345678-1234-4234-8234-123456789abc');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('generates an RFC 4122 version 4 UUID when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0)
    });

    expect(createClientUuid()).toBe('00000000-0000-4000-8000-000000000000');
  });
});