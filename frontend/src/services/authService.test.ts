import { describe, it, expect } from 'vitest';
import {
  generateLocalPinVerifier,
  verifyLocalPin,
  derivePbkdf2PinHash,
  computeLocalPinHash
} from './authService';

describe('authService PIN cryptography', () => {
  it('generates PBKDF2 verifier with random salt and matches valid PIN', async () => {
    const pin = '1234';
    const verifier = await generateLocalPinVerifier(pin, 1000); // 1,000 for fast test

    expect(verifier).toMatch(/^pbkdf2:v1:1000:[0-9a-f]{32}:[0-9a-f]{64}$/);

    const isValid = await verifyLocalPin(pin, verifier);
    expect(isValid).toBe(true);

    const isInvalid = await verifyLocalPin('4321', verifier);
    expect(isInvalid).toBe(false);
  });

  it('generates distinct salts for the same PIN', async () => {
    const pin = '5678';
    const verifier1 = await generateLocalPinVerifier(pin, 1000);
    const verifier2 = await generateLocalPinVerifier(pin, 1000);

    expect(verifier1).not.toBe(verifier2);
    expect(await verifyLocalPin(pin, verifier1)).toBe(true);
    expect(await verifyLocalPin(pin, verifier2)).toBe(true);
  });

  it('derives PBKDF2 hash deterministically for the same salt', async () => {
    const salt = new Uint8Array(16);
    const hash1 = await derivePbkdf2PinHash('1234', salt, 500);
    const hash2 = await derivePbkdf2PinHash('1234', salt, 500);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects malformed verifier strings gracefully', async () => {
    expect(await verifyLocalPin('1234', '')).toBe(false);
    expect(await verifyLocalPin('1234', 'pbkdf2:v1:not-a-number:salt:hash')).toBe(false);
    expect(await verifyLocalPin('1234', 'pbkdf2:v1:1000:invalid-salt')).toBe(false);
    expect(await verifyLocalPin('', 'pbkdf2:v1:1000:abc:def')).toBe(false);
  });

  it('supports legacy single-pass SHA-256 verifier with legacySalt', async () => {
    const pin = '9999';
    const salt = 'tenant-legacy-uuid';
    const legacyVerifier = await computeLocalPinHash(pin, salt);

    expect(await verifyLocalPin(pin, legacyVerifier, salt)).toBe(true);
    expect(await verifyLocalPin('0000', legacyVerifier, salt)).toBe(false);
  });
});
