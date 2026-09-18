// ============================================
// Bangladesh Business Tycoon - Password Hashing
// ============================================
//
// scrypt from node:crypto — no extra dependency, and memory-hard enough that a
// stolen hash is expensive to attack. The stored string carries its own
// parameters so the cost can be raised later without invalidating old hashes.

import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };
// scrypt's default maxmem (32 MB) is too tight for N=16384, r=8 on some builds.
const MAX_MEM = 64 * 1024 * 1024;

/** Hash a plaintext password into `scrypt$N$r$p$salt$key` (all hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAX_MEM,
  });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

/**
 * Compare a plaintext password against a stored hash.
 * Returns false for malformed or missing hashes rather than throwing, so a
 * Google-only account (no password) simply fails the password check.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'hex');
    expected = Buffer.from(parts[5], 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scryptAsync(password.normalize('NFKC'), salt, expected.length, {
    N,
    r,
    p,
    maxmem: MAX_MEM,
  });

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
