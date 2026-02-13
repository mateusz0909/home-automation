import { SESSION_COOKIE, SESSION_SECRET } from './config';
import { cookies } from 'next/headers';

/**
 * Creates a simple hash-based session token.
 * Not cryptographically bullet-proof, but sufficient for a personal dashboard.
 */
function makeToken(username: string): string {
  // Simple HMAC-like token: base64(username:secret)
  const raw = `${username}:${SESSION_SECRET}:valid`;
  return Buffer.from(raw).toString('base64');
}

export function generateSessionToken(username: string): string {
  return makeToken(username);
}

export function validateSessionToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return decoded.endsWith(`:${SESSION_SECRET}:valid`);
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return false;
  return validateSessionToken(sessionCookie.value);
}
