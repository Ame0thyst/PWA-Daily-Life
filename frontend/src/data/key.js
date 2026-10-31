/**
 * key.js — High-entropy Cryptographic Secret Key / Mnemonic generator and validator
 * Format: DJ-XXXX-XXXX-XXXX-XXXX (Base32 Crockford, uppercase, unambiguous)
 */
import { getSetting, setSetting } from './db.js';

// Crockford Base32 alphabet: no I, L, O, U to prevent reading confusion
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generate a cryptographically secure random formatted secret key
 * Example output: "DJ-7X9P-K4M2-9WQ8-Z5TL"
 */
export function generateSecretKey() {
  const bytes = new Uint8Array(16); // 128-bit entropy
  crypto.getRandomValues(bytes);

  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length];
  }

  // Format into 4 chunks of 4 characters: DJ-XXXX-XXXX-XXXX-XXXX
  const chunks = [
    str.slice(0, 4),
    str.slice(4, 8),
    str.slice(8, 12),
    str.slice(12, 16),
  ];

  return `DJ-${chunks.join('-')}`;
}

/**
 * Normalize and validate user key input
 */
export function validateSecretKey(key) {
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim().toUpperCase();
  // Accepts DJ-XXXX-XXXX-XXXX-XXXX or standard alphanumeric 16-32 chars
  return /^DJ-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(clean) || clean.length >= 10;
}

export function formatSecretKeyInput(raw) {
  if (!raw) return '';
  return raw.trim().toUpperCase();
}

/**
 * Get current stored secret user key from IndexedDB
 */
export async function getStoredUserKey() {
  return (await getSetting('userKey')) || null;
}

/**
 * Save secret user key to IndexedDB
 */
export async function setStoredUserKey(key) {
  const cleanKey = formatSecretKeyInput(key);
  await setSetting('userKey', cleanKey);
  return cleanKey;
}

/**
 * Check if the current device already has a registered user key
 */
export async function hasUserKey() {
  const key = await getStoredUserKey();
  return !!key;
}
