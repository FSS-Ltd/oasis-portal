/**
 * Envelope encryption for PII (ADR-0006, supersedes ADR-0005).
 *
 * Strategy:
 *   - Per-record data encryption key (DEK), 32 random bytes.
 *   - DEK encrypts the field with AES-256-GCM, then is wrapped with the
 *     env-managed master key (also AES-256-GCM) and discarded.
 *   - Wire format (base64-joined):
 *       v1:<keyVersion>:<wrappedDek>:<wrapIv>:<wrapTag>:<iv>:<tag>:<ct>
 *   - Older master-key versions stay available as `OASIS_MASTER_KEY_V<n>`
 *     so ciphertexts written before rotation can still decrypt.
 *
 * Decryption only happens in-process after RBAC passes. Every decrypt is
 * audited at the tRPC layer.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm' as const;
const IV_LEN = 12;
const KEY_LEN = 32;
const AUTH_TAG_LEN = 16;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function b64(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64');
}

function fromB64(s: string): Buffer {
  return Buffer.from(s, 'base64');
}

function loadMasterKey(version: string): Buffer {
  // v1 is read from OASIS_MASTER_KEY for ergonomics; v2+ from OASIS_MASTER_KEY_V<n>.
  const envName = version === '1' ? 'OASIS_MASTER_KEY' : `OASIS_MASTER_KEY_V${version}`;
  const raw = requireEnv(envName);
  const key = fromB64(raw);
  if (key.length !== KEY_LEN) {
    throw new Error(
      `${envName} must decode to ${String(KEY_LEN)} bytes (got ${String(key.length)}).`,
    );
  }
  return key;
}

function activeKeyVersion(): string {
  return process.env['OASIS_MASTER_KEY_VERSION'] ?? '1';
}

/**
 * Encrypt a plaintext string into the v1 wire format.
 * Returns `null` for null/undefined input to preserve nullability at the field level.
 */
export function encryptField(plaintext: string): string;
export function encryptField(plaintext: string | null | undefined): string | null;
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;

  const keyVersion = activeKeyVersion();
  const masterKey = loadMasterKey(keyVersion);

  const dek = randomBytes(KEY_LEN);
  try {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, dek, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    if (tag.length !== AUTH_TAG_LEN) throw new Error('Unexpected GCM tag length');

    const wrapIv = randomBytes(IV_LEN);
    const wrapper = createCipheriv(ALGO, masterKey, wrapIv);
    const wrappedDek = Buffer.concat([wrapper.update(dek), wrapper.final()]);
    const wrapTag = wrapper.getAuthTag();

    return [
      VERSION,
      keyVersion,
      b64(wrappedDek),
      b64(wrapIv),
      b64(wrapTag),
      b64(iv),
      b64(tag),
      b64(ct),
    ].join(':');
  } finally {
    dek.fill(0);
    masterKey.fill(0);
  }
}

/**
 * Decrypt a v1-wire-format ciphertext. Never call this outside an
 * authenticated, RBAC-checked code path.
 */
export function decryptField(wire: string): string;
export function decryptField(wire: string | null | undefined): string | null;
export function decryptField(wire: string | null | undefined): string | null {
  if (wire === null || wire === undefined) return null;

  const parts = wire.split(':');
  if (parts.length !== 8) throw new Error('Malformed ciphertext');
  const [version, keyVersion, wrappedDekB64, wrapIvB64, wrapTagB64, ivB64, tagB64, ctB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (version !== VERSION) throw new Error(`Unsupported ciphertext version: ${version}`);
  // ctB64 may legitimately be empty (encrypting ""); other parts must be non-empty.
  if (!keyVersion || !wrappedDekB64 || !wrapIvB64 || !wrapTagB64 || !ivB64 || !tagB64) {
    throw new Error('Malformed ciphertext');
  }

  const masterKey = loadMasterKey(keyVersion);
  const unwrapper = createDecipheriv(ALGO, masterKey, fromB64(wrapIvB64));
  unwrapper.setAuthTag(fromB64(wrapTagB64));
  const dek = Buffer.concat([unwrapper.update(fromB64(wrappedDekB64)), unwrapper.final()]);
  masterKey.fill(0);

  try {
    const decipher = createDecipheriv(ALGO, dek, fromB64(ivB64));
    decipher.setAuthTag(fromB64(tagB64));
    const pt = Buffer.concat([decipher.update(fromB64(ctB64)), decipher.final()]);
    return pt.toString('utf8');
  } finally {
    dek.fill(0);
  }
}

/**
 * Deterministic blind index for equality lookups (e.g. email, normalised name).
 * Uses a per-deployment pepper from env; never stored in DB.
 */
export function blindIndex(value: string, pepperEnvVar = 'OASIS_BIDX_PEPPER'): string {
  const pepper = requireEnv(pepperEnvVar);
  const normalised = value.trim().toLowerCase();
  return createHmac('sha256', pepper).update(normalised).digest('hex');
}

/**
 * Prisma client extension placeholder — wires encryption helpers onto the
 * client so callers can do `prisma.$enc.encrypt(...)` / `prisma.$enc.decrypt(...)`.
 *
 * Field-level auto-encrypt/decrypt via Prisma's `$extends` is implemented per
 * model in PR-1.4 / PR-1.6 so every write path explicitly opts in; a blanket
 * extension would make it too easy to accidentally skip encryption on a new
 * PII field.
 */
export function withEncryption<T extends PrismaClient>(client: T): T & {
  $enc: {
    encrypt: typeof encryptField;
    decrypt: typeof decryptField;
    blindIndex: typeof blindIndex;
  };
} {
  return Object.assign(client, {
    $enc: {
      encrypt: encryptField,
      decrypt: decryptField,
      blindIndex,
    },
  });
}
