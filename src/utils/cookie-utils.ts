/**
 * Cookie utils for auth tokens (client-side only)
 */

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const isBrowser = typeof document !== 'undefined';

type SameSite = 'Strict' | 'Lax' | 'None';

function buildCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number;
    expires?: Date;
    path?: string;
    domain?: string;
    sameSite?: SameSite;
    secure?: boolean;
  } = {},
) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${opts.path ?? '/'}`,
  ];
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, opts.maxAge | 0)}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  const sameSite = opts.sameSite ?? 'Lax';
  parts.push(`SameSite=${sameSite}`);
  const secure = opts.secure ?? (sameSite === 'None' || process.env.NODE_ENV === 'production');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** Set access token cookie */
export function setAccessTokenCookie(token: string): void {
  if (!isBrowser) return;
  document.cookie = buildCookie(ACCESS_TOKEN_COOKIE, token, {
    maxAge: ACCESS_TOKEN_MAX_AGE,
    // also set Expires for older agents
    expires: new Date(Date.now() + ACCESS_TOKEN_MAX_AGE * 1000),
    sameSite: 'Lax', // use "Strict" if you don't do OAuth/third-party redirects
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/** Get access token cookie */
export function getAccessTokenCookie(): string | null {
  if (!isBrowser) return null;
  if (!document.cookie) return null;
  const pairs = document.cookie.split(/; */);
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.split('=');
    if (decodeURIComponent(rawName.trim()) === ACCESS_TOKEN_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/** Remove access token cookie */
export function removeAccessTokenCookie(): void {
  if (!isBrowser) return;
  document.cookie = buildCookie(ACCESS_TOKEN_COOKIE, '', {
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

// =============================================================================
// Refresh Token
// =============================================================================

const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Set refresh token cookie */
export function setRefreshTokenCookie(token: string): void {
  if (!isBrowser) return;
  document.cookie = buildCookie(REFRESH_TOKEN_COOKIE, token, {
    maxAge: REFRESH_TOKEN_MAX_AGE,
    expires: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/** Get refresh token cookie */
export function getRefreshTokenCookie(): string | null {
  if (!isBrowser) return null;
  if (!document.cookie) return null;
  const pairs = document.cookie.split(/; */);
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.split('=');
    if (decodeURIComponent(rawName.trim()) === REFRESH_TOKEN_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/** Remove refresh token cookie */
export function removeRefreshTokenCookie(): void {
  if (!isBrowser) return;
  document.cookie = buildCookie(REFRESH_TOKEN_COOKIE, '', {
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/** Remove all auth cookies */
export function removeAllAuthCookies(): void {
  removeAccessTokenCookie();
  removeRefreshTokenCookie();
}
