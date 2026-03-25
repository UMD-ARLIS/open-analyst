import { createCookieSessionStorage } from 'react-router';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__oa_session',
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
    sameSite: 'lax',
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === 'production',
  },
});

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

/** Minimal data stored in the cookie; tokens live server-side */
export interface SessionCookieUser {
  userId: string;
  email: string;
  name: string;
}

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get('Cookie'));
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const { getTokens } = await import('./token-store.server');
  const session = await getSession(request);
  const cookieUser = session.get('user') as SessionCookieUser | SessionUser | undefined;
  if (!cookieUser?.userId) return null;

  // Hydrate tokens from server-side store
  const tokens = getTokens(cookieUser.userId);
  return {
    userId: cookieUser.userId,
    email: cookieUser.email,
    name: cookieUser.name,
    accessToken: tokens?.accessToken || (cookieUser as SessionUser).accessToken || '',
    refreshToken: tokens?.refreshToken || (cookieUser as SessionUser).refreshToken || '',
    idToken: tokens?.idToken || (cookieUser as SessionUser).idToken || '',
    expiresAt: tokens?.expiresAt || (cookieUser as SessionUser).expiresAt || 0,
  };
}

export async function commitSession(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  return sessionStorage.commitSession(session);
}

export async function destroySession(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  return sessionStorage.destroySession(session);
}
