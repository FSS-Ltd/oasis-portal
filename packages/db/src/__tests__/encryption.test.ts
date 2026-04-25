import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { blindIndex, decryptField, encryptField } from '../encryption.js';

const KEY_V1 = randomBytes(32).toString('base64');
const KEY_V2 = randomBytes(32).toString('base64');
const PEPPER = 'test-pepper-not-real';

describe('encryptField / decryptField', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['OASIS_MASTER_KEY'] = KEY_V1;
    process.env['OASIS_MASTER_KEY_VERSION'] = '1';
    delete process.env['OASIS_MASTER_KEY_V2'];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('round-trips a string', () => {
    const wire = encryptField('Jean-Fidele Ntagengwa');
    expect(wire.startsWith('v1:1:')).toBe(true);
    expect(decryptField(wire)).toBe('Jean-Fidele Ntagengwa');
  });

  it('round-trips unicode and empty string', () => {
    expect(decryptField(encryptField('☃ Iñtërnâtiônàl'))).toBe('☃ Iñtërnâtiônàl');
    expect(decryptField(encryptField(''))).toBe('');
  });

  it('passes through null and undefined', () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeNull();
    expect(decryptField(null)).toBeNull();
    expect(decryptField(undefined)).toBeNull();
  });

  it('produces a different ciphertext on each call (random DEK + IV)', () => {
    const a = encryptField('same input');
    const b = encryptField('same input');
    expect(a).not.toBe(b);
  });

  it('rejects a tampered ciphertext (GCM auth-tag mismatch)', () => {
    const wire = encryptField('payload');
    const parts = wire.split(':');
    // flip a bit in the data ciphertext (last segment)
    const ct = Buffer.from(parts[7] ?? '', 'base64');
    ct[0] = (ct[0] ?? 0) ^ 0x01;
    parts[7] = ct.toString('base64');
    const tampered = parts.join(':');
    expect(() => decryptField(tampered)).toThrow();
  });

  it('rejects a tampered wrapped DEK', () => {
    const wire = encryptField('payload');
    const parts = wire.split(':');
    const wrapped = Buffer.from(parts[2] ?? '', 'base64');
    wrapped[0] = (wrapped[0] ?? 0) ^ 0x02;
    parts[2] = wrapped.toString('base64');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it('decrypts ciphertexts written under an older key version after rotation', () => {
    const wireV1 = encryptField('legacy');

    // Rotate: v2 becomes active; v1 stays available.
    process.env['OASIS_MASTER_KEY_V2'] = KEY_V2;
    process.env['OASIS_MASTER_KEY_VERSION'] = '2';

    const wireV2 = encryptField('fresh');
    expect(wireV2.startsWith('v1:2:')).toBe(true);

    expect(decryptField(wireV1)).toBe('legacy');
    expect(decryptField(wireV2)).toBe('fresh');
  });

  it('throws if the master key is missing', () => {
    delete process.env['OASIS_MASTER_KEY'];
    expect(() => encryptField('x')).toThrow(/OASIS_MASTER_KEY/);
  });

  it('throws if the master key is the wrong length', () => {
    process.env['OASIS_MASTER_KEY'] = Buffer.from('too-short').toString('base64');
    expect(() => encryptField('x')).toThrow(/32 bytes/);
  });

  it('rejects malformed wire format', () => {
    expect(() => decryptField('not-a-ciphertext')).toThrow(/Malformed/);
    expect(() => decryptField('v0:1:a:b:c:d:e:f')).toThrow(/Unsupported/);
  });
});

describe('blindIndex', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['OASIS_BIDX_PEPPER'] = PEPPER;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('is deterministic for the same normalised input', () => {
    expect(blindIndex('Hello@Example.com  ')).toBe(blindIndex('hello@example.com'));
  });

  it('changes when the pepper changes', () => {
    const a = blindIndex('hello@example.com');
    process.env['OASIS_BIDX_PEPPER'] = 'different-pepper';
    const b = blindIndex('hello@example.com');
    expect(a).not.toBe(b);
  });

  it('throws if the pepper is missing', () => {
    delete process.env['OASIS_BIDX_PEPPER'];
    expect(() => blindIndex('x')).toThrow(/OASIS_BIDX_PEPPER/);
  });
});
