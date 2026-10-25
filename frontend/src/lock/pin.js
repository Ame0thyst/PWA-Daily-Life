/**
 * pin.js — Cryptographic PIN hashing using PBKDF2 (SHA-256, 310,000 iterations)
 * Includes exponential backoff lockout after 5 consecutive failed attempts.
 */
import { getSetting, setSetting } from '../data/db.js';

const ITERATIONS = 310000;

export async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256
  );

  return new Uint8Array(bits);
}

function bufferToHex(buf) {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function isPinSet() {
  const hash = await getSetting('pinHash');
  return !!hash;
}

export async function getPinLength() {
  const len = await getSetting('pinLength');
  return len ? parseInt(len, 10) : 4;
}

export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPin(pin, salt);

  await setSetting('pinSalt', bufferToHex(salt));
  await setSetting('pinHash', bufferToHex(hash));
  await setSetting('pinLength', pin.length);
  await resetFailedAttempts();
}

export async function removePin() {
  await setSetting('pinSalt', null);
  await setSetting('pinHash', null);
  await setSetting('pinLength', null);
  await resetFailedAttempts();
}

export async function verifyPin(pin) {
  // Check lockout
  const lockoutUntil = await getSetting('pinLockoutUntil');
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const remainingSecs = Math.ceil((lockoutUntil - Date.now()) / 1000);
    return { ok: false, lockedOut: true, remainingSecs };
  }

  const saltHex = await getSetting('pinSalt');
  const expectedHashHex = await getSetting('pinHash');

  if (!saltHex || !expectedHashHex) {
    return { ok: true }; // No PIN set
  }

  const salt = hexToBuffer(saltHex);
  const hash = await hashPin(pin, salt);
  const hashHex = bufferToHex(hash);

  if (hashHex === expectedHashHex) {
    await resetFailedAttempts();
    return { ok: true };
  } else {
    const failedInfo = await recordFailedAttempt();
    return { ok: false, lockedOut: failedInfo.lockedOut, remainingSecs: failedInfo.remainingSecs };
  }
}

async function recordFailedAttempt() {
  let count = (await getSetting('pinFailedAttempts')) || 0;
  count += 1;
  await setSetting('pinFailedAttempts', count);

  if (count >= 5) {
    // Exponential backoff: 30s, 60s, 120s, 240s...
    const multiplier = Math.pow(2, count - 5);
    const delaySecs = Math.min(30 * multiplier, 3600);
    const lockoutUntil = Date.now() + delaySecs * 1000;
    await setSetting('pinLockoutUntil', lockoutUntil);
    return { lockedOut: true, remainingSecs: delaySecs };
  }

  return { lockedOut: false, remainingSecs: 0 };
}

async function resetFailedAttempts() {
  await setSetting('pinFailedAttempts', 0);
  await setSetting('pinLockoutUntil', null);
}

export async function getLockoutRemaining() {
  const lockoutUntil = await getSetting('pinLockoutUntil');
  if (lockoutUntil && Date.now() < lockoutUntil) {
    return Math.ceil((lockoutUntil - Date.now()) / 1000);
  }
  return 0;
}
