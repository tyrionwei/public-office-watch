const PUBLIC_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const URL_OR_EMAIL_PATTERN = /(?:https?:\/\/|www\.|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|tw|io|me|co|cc|app|dev|info|biz)(?:\b|\/)|[^\s@]+@[^\s@]+\.[^\s@]+)/iu;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; code: string };

export function countVisibleCharacters(value: string) {
  return Array.from(value).length;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

export function validateDisplayName(value: unknown): ValidationResult {
  const normalized = normalizeText(value);
  const length = countVisibleCharacters(normalized);

  if (/\r|\n/u.test(normalized) || length < 2 || length > 12) {
    return { ok: false, code: 'CHAT_INVALID_DISPLAY_NAME' };
  }

  return { ok: true, value: normalized };
}

export function validateMessageBody(value: unknown): ValidationResult {
  const normalized = normalizeText(value);
  const length = countVisibleCharacters(normalized);

  if (/\r|\n/u.test(normalized) || length < 1 || length > 50) {
    return { ok: false, code: 'CHAT_INVALID_BODY' };
  }

  if (URL_OR_EMAIL_PATTERN.test(normalized)) {
    return { ok: false, code: 'CHAT_EXTERNAL_LINK' };
  }

  return { ok: true, value: normalized };
}

export function validateReplyId(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

export function generatePublicCode(randomBytes = crypto.getRandomValues(new Uint8Array(6))) {
  return Array.from(
    randomBytes,
    (byte) => PUBLIC_CODE_ALPHABET[byte % PUBLIC_CODE_ALPHABET.length],
  ).join('');
}

export function getTrustedClientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const candidate = forwarded
    || headers.get('cf-connecting-ip')?.trim()
    || headers.get('x-real-ip')?.trim();

  if (!candidate || /[\r\n]/u.test(candidate)) {
    return null;
  }

  return candidate.replace(/^::ffff:/iu, '');
}

function bytesToBase64Url(bytes: Uint8Array) {
  const encoded = btoa(String.fromCharCode(...bytes));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function hmacSha256Hex(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function encryptIp(value: string, encodedKey: string) {
  const rawKey = base64ToBytes(encodedKey);
  if (rawKey.length !== 32) {
    throw new Error('CHAT_IP_ENCRYPTION_KEY must decode to 32 bytes');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  );

  return `gcm.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}
