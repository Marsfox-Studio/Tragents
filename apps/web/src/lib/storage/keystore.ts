// Encrypted secret storage using WebCrypto AES-GCM.
//
// v0.1 uses a non-extractable device-bound key stored in IndexedDB. This
// protects against casual disk-level snooping but not against a malicious
// page running in the same origin. Future: optional master passphrase
// (PBKDF2) for users who want stronger protection at the cost of UX.

import { STORES, idbDelete, idbGet, idbPut } from './db.js';

const DEVICE_KEY_KEY = 'device-key-v1';
const TEXT = new TextEncoder();
const DEC = new TextDecoder();

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(STORES.settings, DEVICE_KEY_KEY);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable — cannot be read out via exportKey
    ['encrypt', 'decrypt'],
  );
  await idbPut(STORES.settings, key, DEVICE_KEY_KEY);
  return key;
}

/**
 * Encrypt a UTF-8 string. Returns iv||ciphertext as a single Uint8Array.
 */
export async function encryptString(plaintext: string): Promise<Uint8Array> {
  const key = await getOrCreateDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, TEXT.encode(plaintext)),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv, 0);
  out.set(ciphertext, iv.length);
  return out;
}

/**
 * Decrypt a blob produced by encryptString. Returns the original UTF-8 string.
 */
export async function decryptString(blob: Uint8Array): Promise<string> {
  const key = await getOrCreateDeviceKey();
  const iv = blob.slice(0, 12);
  const ciphertext = blob.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return DEC.decode(plaintext);
}

/**
 * Reset the device key. Will make all previously encrypted secrets unreadable.
 * Currently only called from settings → "Forget all API keys".
 */
export async function resetDeviceKey(): Promise<void> {
  await idbDelete(STORES.settings, DEVICE_KEY_KEY);
}
