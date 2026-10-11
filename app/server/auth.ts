import { scryptAsync } from '@noble/hashes/scrypt.js';
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function derive(password: string, salt: string) { return hex(await scryptAsync(encoder.encode(password), encoder.encode(salt), { N: 16384, r: 8, p: 5, dkLen: 32, maxmem: 32 * 1024 * 1024 })); }
export async function hashPassword(password: string) { const salt = randomToken(); return `scrypt:16384:8:5:${salt}:${await derive(password, salt)}`; }
export async function verifyPassword(password: string, stored: string) { const parts = stored.split(':'); if (parts.length !== 6 || parts[0] !== 'scrypt') return false; const actual = await derive(password, parts[4]); let mismatch = actual.length ^ parts[5].length; for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ (parts[5].charCodeAt(i) || 0); return mismatch === 0; }
