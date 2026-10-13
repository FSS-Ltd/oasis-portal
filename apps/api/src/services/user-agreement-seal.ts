import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from 'node:crypto';
import { sha256 } from './user-agreement-storage.js';

export const AGREEMENT_ACKNOWLEDGEMENT = 'I have read and understand this form.';

export interface AgreementEvidence {
  schemaVersion: 1;
  signatureId: string;
  requestId: string;
  recipientId: string;
  actorId: string;
  method: 'Portal' | 'HeadRecorded';
  typedName: string;
  acknowledgementVersion: 1 | null;
  acknowledgement: string | null;
  openedAt: string | null;
  signedAt: string;
  declaredSignedOn: string | null;
  originalSha256: string;
  completedSha256: string;
  manualSourceSha256: string | null;
}

export function newAgreementSignatureId(): string {
  return randomUUID();
}

function serialiseEvidence(evidence: AgreementEvidence): Buffer {
  return Buffer.from(
    JSON.stringify([
      evidence.schemaVersion,
      evidence.signatureId,
      evidence.requestId,
      evidence.recipientId,
      evidence.actorId,
      evidence.method,
      evidence.typedName,
      evidence.acknowledgementVersion,
      evidence.acknowledgement,
      evidence.openedAt,
      evidence.signedAt,
      evidence.declaredSignedOn,
      evidence.originalSha256,
      evidence.completedSha256,
      evidence.manualSourceSha256,
    ]),
  );
}

function trustedPublicKeys(): Record<string, string> {
  const publicKeysJson = process.env['USER_AGREEMENT_SIGNING_PUBLIC_KEYS'];
  if (!publicKeysJson) throw new Error('Agreement verification keys are not configured.');
  const publicKeys: unknown = JSON.parse(publicKeysJson);
  if (
    !publicKeys ||
    typeof publicKeys !== 'object' ||
    Array.isArray(publicKeys) ||
    !Object.values(publicKeys).every((value) => typeof value === 'string')
  ) {
    throw new Error('Invalid signing public keys.');
  }
  return publicKeys as Record<string, string>;
}

function signingKeys() {
  const keyId = process.env['USER_AGREEMENT_SIGNING_KEY_ID']?.trim();
  const privatePem = process.env['USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM']?.replace(/\\n/gu, '\n');
  if (!keyId || !privatePem) throw new Error('Agreement signing key is not configured.');
  const publicKeys = trustedPublicKeys();
  const publicPem = publicKeys[keyId];
  if (typeof publicPem !== 'string') throw new Error('Current signing public key is missing.');
  const privateKey = createPrivateKey(privatePem);
  const publicKey = createPublicKey(publicPem.replace(/\\n/gu, '\n'));
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Agreement keys must use Ed25519.');
  }
  return { keyId, privateKey, publicKeys };
}

export function sealAgreementEvidence(evidence: AgreementEvidence): {
  keyId: string;
  seal: string;
} {
  const { keyId, privateKey } = signingKeys();
  const seal = sign(null, serialiseEvidence(evidence), privateKey).toString('base64');
  return { keyId, seal };
}

export function verifyAgreementEvidence(
  evidence: AgreementEvidence,
  keyId: string,
  seal: string,
  original: Uint8Array,
  completed: Uint8Array,
  manualSource?: Uint8Array,
): boolean {
  const publicKeys = trustedPublicKeys();
  const publicPem = publicKeys[keyId];
  if (
    !publicPem ||
    evidence.originalSha256 !== sha256(original) ||
    evidence.completedSha256 !== sha256(completed) ||
    (evidence.manualSourceSha256 !== null &&
      (!manualSource || evidence.manualSourceSha256 !== sha256(manualSource)))
  ) {
    return false;
  }
  try {
    return verify(
      null,
      serialiseEvidence(evidence),
      createPublicKey(publicPem.replace(/\\n/gu, '\n')),
      Buffer.from(seal, 'base64'),
    );
  } catch {
    return false;
  }
}
