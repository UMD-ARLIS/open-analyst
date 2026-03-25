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

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get('Cookie'));
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const session = await getSession(request);
  const user = session.get('user') as SessionUser | undefined;
  if (!user?.userId) return null;
  return user;
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
