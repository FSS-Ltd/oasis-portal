export function encryptTestValue(value: string): string;
export function encryptTestValue(value: null | undefined): null;
export function encryptTestValue(value: string | null | undefined): string | null;
export function encryptTestValue(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : `enc:${value}`;
}

export function decryptTestValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}
