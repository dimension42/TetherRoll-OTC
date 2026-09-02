import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM 암호화 (trades.bank_info_enc 등).
 * ENCRYPTION_KEY: 32바이트 hex 문자열 (64 hex chars).
 */

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  return Buffer.from(hex, 'hex');
}

/** JSON → 암호화 → base64 문자열 */
export function encryptJson(data: unknown): string {
  const plaintext = JSON.stringify(data);
  const iv = randomBytes(12); // GCM 권장 12바이트
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + tag(16) + ciphertext를 하나의 버퍼로 묶어 base64
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

/** base64 문자열 → 복호화 → JSON */
export function decryptJson<T = unknown>(ciphertext: string): T {
  const combined = Buffer.from(ciphertext, 'base64');
  const iv = combined.subarray(0, 12);
  const tag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as T;
}
