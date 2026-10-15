// Time-based one-time codes (RFC 6238, SHA-1, 6 digits, 30 s), compatible with common authenticator apps.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;

export function base32Encode(bytes: Uint8Array) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string) {
  let bits = 0, value = 0; const out: number[] = [];
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char); if (index < 0) throw new Error('Invalid base32');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

export async function totpCode(secret: string, step: number) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = new Uint8Array(8); new DataView(counter.buffer).setBigUint64(0, BigInt(step));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = mac[mac.length - 1] & 15;
  const number = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(number % 1_000_000).padStart(6, '0');
}

/** Returns the matching time step (one step of clock drift either way), or null. Steps at or before lastStep are replays. */
export async function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 1000 / STEP);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (await totpCode(secret, step) === code) return step;
  }
  return null;
}

export const otpauthUri = (email: string, secret: string) =>
  `otpauth://totp/${encodeURIComponent('Рядом:' + email)}?secret=${secret}&issuer=${encodeURIComponent('Рядом')}&digits=6&period=${STEP}`;
