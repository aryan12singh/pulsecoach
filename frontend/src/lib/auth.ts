// Session-token helpers for the optional APP_PASSWORD login.
// Web Crypto only (no node:crypto) so the same code runs in middleware and
// route handlers.

export const SESSION_COOKIE = "pc_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const encoder = new TextEncoder();

async function hmacKey(password: string): Promise<CryptoKey> {
  // Key derived from the password: rotating APP_PASSWORD invalidates sessions.
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`pulsecoach-session-v1:${password}`),
  );
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(password: string, payload: string): Promise<string> {
  const key = await hmacKey(password);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function passwordsMatch(supplied: string, expected: string): Promise<boolean> {
  // Hash both sides so the comparison is constant-time regardless of length.
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return timingSafeEqualHex(toHex(a), toHex(b));
}

export async function createSessionToken(password: string): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  return `${expires}.${await sign(password, String(expires))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  password: string,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expires = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiresMs = Number(expires);
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) return false;
  return timingSafeEqualHex(sig, await sign(password, expires));
}
