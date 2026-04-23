/**
 * KMS envelope encryption for PII (ADR-005).
 *
 * Strategy:
 *   - Per-record data encryption key (DEK) generated via AWS KMS GenerateDataKey.
 *   - Plaintext DEK used in-memory once to AES-256-GCM encrypt the field, then discarded.
 *   - Wrapped (KMS-encrypted) DEK stored alongside the ciphertext.
 *   - Ciphertext wire format: `v1:<kmsKeyId>:<wrappedDek>:<iv>:<tag>:<ct>` base64-joined.
 *
 * Decryption only happens in-process after RBAC passes. Every decrypt is audited.
 */
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm' as const;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

let kms: KMSClient | null = null;
function getKms(): KMSClient {
  kms ??= new KMSClient({ region: process.env['AWS_REGION'] ?? 'eu-west-2' });
  return kms;
}

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

export interface EncryptedField {
  ciphertext: string; // formatted string, safe to store in a text column
}

/**
 * Encrypt a plaintext string into the v1 wire format.
 * Returns `null` for null/undefined input to preserve nullability at the field level.
 */
export async function encryptField(plaintext: string): Promise<string>;
export async function encryptField(plaintext: string | null | undefined): Promise<string | null>;
export async function encryptField(plaintext: string | null | undefined): Promise<string | null> {
  if (plaintext === null || plaintext === undefined) return null;
  const keyId = requireEnv('KMS_KEY_ID');
  const result = await getKms().send(
    new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: 'AES_256' }),
  );
  if (!result.Plaintext || !result.CiphertextBlob) {
    throw new Error('KMS did not return a usable data key');
  }
  const dek = Buffer.from(result.Plaintext);
  const wrappedDek = Buffer.from(result.CiphertextBlob);

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, dek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== AUTH_TAG_LEN) throw new Error('Unexpected GCM tag length');

  // Zero the plaintext DEK — Buffer is the JS-accessible copy we can wipe.
  dek.fill(0);

  return [VERSION, keyId, b64(wrappedDek), b64(iv), b64(tag), b64(ct)].join(':');
}

/**
 * Decrypt a v1-wire-format ciphertext. Never call this outside an
 * authenticated, RBAC-checked code path.
 */
export async function decryptField(wire: string): Promise<string>;
export async function decryptField(wire: string | null | undefined): Promise<string | null>;
export async function decryptField(wire: string | null | undefined): Promise<string | null> {
  if (wire === null || wire === undefined) return null;
  const [version, _keyId, wrappedDekB64, ivB64, tagB64, ctB64] = wire.split(':');
  if (version !== VERSION) throw new Error(`Unsupported ciphertext version: ${String(version)}`);
  if (!wrappedDekB64 || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed ciphertext');
  }
  const unwrapped = await getKms().send(
    new DecryptCommand({ CiphertextBlob: fromB64(wrappedDekB64) }),
  );
  if (!unwrapped.Plaintext) throw new Error('KMS decrypt returned no plaintext');
  const dek = Buffer.from(unwrapped.Plaintext);

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
 * Deterministic blind index for equality lookups (e.g. email).
 * Uses a per-field pepper stored only in env/KMS; never in DB.
 */
export function blindIndex(value: string, pepperEnvVar: string): string {
  const pepper = requireEnv(pepperEnvVar);
  const normalised = value.trim().toLowerCase();
  return createHmac('sha256', pepper).update(normalised).digest('hex');
}

/**
 * Prisma client extension placeholder — wires encryption helpers onto the client
 * so callers can do `prisma.$enc.encrypt(...)` / `prisma.$enc.decrypt(...)`.
 *
 * Field-level auto-encrypt/decrypt via Prisma's `$extends` is implemented per
 * model in a follow-up (Phase 1) so every write path explicitly opts in; a
 * blanket extension would make it too easy to accidentally skip encryption on
 * a new PII field.
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
