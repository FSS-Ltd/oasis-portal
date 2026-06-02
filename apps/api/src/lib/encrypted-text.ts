import { TRPCError } from '@trpc/server';

interface EncryptionCodec {
  decrypt(value: string | null | undefined): string | null;
  encrypt(value: string): string;
}

export function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function encryptOptionalText(
  codec: EncryptionCodec,
  value: string | undefined,
): string | null {
  const normalized = optionalText(value);
  return normalized ? codec.encrypt(normalized) : null;
}

export function decryptOptionalText(
  codec: Pick<EncryptionCodec, 'decrypt'>,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return codec.decrypt(value);
}

export function decryptRequiredText(
  codec: Pick<EncryptionCodec, 'decrypt'>,
  value: string,
  entity: string,
): string {
  const decrypted = codec.decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}
