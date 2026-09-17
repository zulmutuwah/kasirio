/**
 * Utilitas Keamanan & Hash PIN Kasirio
 * Menggunakan Web Crypto API (SubtleCrypto) bawaan browser standar industri.
 */

const LOCAL_SALT = 'kasirio_security_salt_2026';

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(LOCAL_SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, expectedHash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  return computed === expectedHash;
}

// Hash default untuk PIN awal Owner: '123456'
export const DEFAULT_OWNER_PIN = '123456';
