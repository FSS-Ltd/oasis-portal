import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AGREEMENT_ACKNOWLEDGEMENT,
  sealAgreementEvidence,
  verifyAgreementEvidence,
  type AgreementEvidence,
} from '../services/user-agreement-seal.js';
import { sha256 } from '../services/user-agreement-storage.js';

const originalEnvironment = {
  keyId: process.env['USER_AGREEMENT_SIGNING_KEY_ID'],
  privateKey: process.env['USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM'],
  publicKeys: process.env['USER_AGREEMENT_SIGNING_PUBLIC_KEYS'],
};

function configureKeys(keyId: string, retained: Record<string, string> = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  process.env['USER_AGREEMENT_SIGNING_KEY_ID'] = keyId;
  process.env['USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM'] = privatePem;
  process.env['USER_AGREEMENT_SIGNING_PUBLIC_KEYS'] = JSON.stringify({
    ...retained,
    [keyId]: publicPem,
  });
  return publicPem;
}

function evidence(original: Uint8Array, completed: Uint8Array): AgreementEvidence {
  return {
    schemaVersion: 1,
    signatureId: 'signature-1',
    requestId: 'request-1',
    recipientId: 'recipient-1',
    actorId: 'recipient-1',
    method: 'Portal',
    typedName: 'Jane Example',
    acknowledgementVersion: 1,
    acknowledgement: AGREEMENT_ACKNOWLEDGEMENT,
    openedAt: '2026-10-13T10:00:00.000Z',
    signedAt: '2026-10-13T10:01:00.000Z',
    declaredSignedOn: null,
    originalSha256: sha256(original),
    completedSha256: sha256(completed),
    manualSourceSha256: null,
  };
}

afterEach(() => {
  if (originalEnvironment.keyId === undefined) delete process.env['USER_AGREEMENT_SIGNING_KEY_ID'];
  else process.env['USER_AGREEMENT_SIGNING_KEY_ID'] = originalEnvironment.keyId;
  if (originalEnvironment.privateKey === undefined)
    delete process.env['USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM'];
  else process.env['USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM'] = originalEnvironment.privateKey;
  if (originalEnvironment.publicKeys === undefined)
    delete process.env['USER_AGREEMENT_SIGNING_PUBLIC_KEYS'];
  else process.env['USER_AGREEMENT_SIGNING_PUBLIC_KEYS'] = originalEnvironment.publicKeys;
});

describe('user agreement cryptographic seal', () => {
  it('verifies stored evidence and rejects altered PDFs, evidence, or keys', () => {
    configureKeys('first');
    const original = Buffer.from('original PDF bytes');
    const completed = Buffer.from('completed PDF bytes');
    const record = evidence(original, completed);
    const signed = sealAgreementEvidence(record);
    expect(verifyAgreementEvidence(record, signed.keyId, signed.seal, original, completed)).toBe(
      true,
    );
    expect(
      verifyAgreementEvidence(record, signed.keyId, signed.seal, original, Buffer.from('altered')),
    ).toBe(false);
    expect(
      verifyAgreementEvidence(
        { ...record, typedName: 'Someone Else' },
        signed.keyId,
        signed.seal,
        original,
        completed,
      ),
    ).toBe(false);
    expect(verifyAgreementEvidence(record, 'unknown', signed.seal, original, completed)).toBe(
      false,
    );
  });

  it('keeps older signatures verifiable after key rotation without the old private key', () => {
    const oldPublicKey = configureKeys('old');
    const original = Buffer.from('original');
    const completed = Buffer.from('completed');
    const record = evidence(original, completed);
    const signed = sealAgreementEvidence(record);
    configureKeys('current', { old: oldPublicKey });
    delete process.env['USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM'];
    expect(verifyAgreementEvidence(record, signed.keyId, signed.seal, original, completed)).toBe(
      true,
    );
  });

  it('fails safely when signing configuration is absent', () => {
    delete process.env['USER_AGREEMENT_SIGNING_KEY_ID'];
    delete process.env['USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM'];
    delete process.env['USER_AGREEMENT_SIGNING_PUBLIC_KEYS'];
    expect(() => sealAgreementEvidence(evidence(Buffer.from('a'), Buffer.from('b')))).toThrow();
  });
});
