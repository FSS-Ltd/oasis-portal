import { Prisma } from '@prisma/client';
import { blindIndex, encryptField } from '@oasis/db';

export function dayOffset(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function dateValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function enc(value: string): string {
  return encryptField(value);
}

export function bidx(value: string): string {
  return blindIndex(value);
}

export function encodedJson(value: Prisma.JsonObject): string {
  return enc(JSON.stringify(value));
}
