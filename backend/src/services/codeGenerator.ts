import { randomInt } from 'node:crypto';

import { DbClient } from '../repositories/catalog.repository.js';

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const MAX_GENERATION_ATTEMPTS = 25;

// ponytail: in-process mutex covers single-instance concurrency -> use DB advisory lock in multi-instance Postgres
let bookingLockChain: Promise<void> = Promise.resolve();

/**
 * Serializes critical booking sections to prevent double-booking races across concurrent requests.
 */
export async function withBookingLock<T>(operation: () => Promise<T>): Promise<T> {
  const previousLock = bookingLockChain;
  let releaseLock!: () => void;
  bookingLockChain = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;
  try {
    return await operation();
  } finally {
    releaseLock();
  }
}

/**
 * Parses a YYYY-MM-DD string into a normalized UTC midnight Date instance.
 */
export function parseDateOnlyUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formats a Date instance to YYYY-MM-DD in UTC.
 */
export function formatDateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns today's normalized UTC midnight Date instance.
 */
export function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Generates a readable unique RF-XXXX reservation code excluding ambiguous characters (O/0/I/1).
 */
export async function generateUniqueReservationCode(db: DbClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      suffix += SAFE_ALPHABET[randomInt(SAFE_ALPHABET.length)];
    }
    const candidate = `RF-${suffix}`;
    const existing = await db.reserva.findUnique({
      where: { codigo: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }

  throw new Error('No fue posible generar un código de reserva único.');
}
