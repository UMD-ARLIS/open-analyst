import { redirect } from 'react-router';
import { destroySession, getSession, getSessionUser, type SessionUser } from './session.server';
import { refreshTokens } from './keycloak.server';
import { deleteTokens, setTokens } from './token-store.server';

const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false';
const DEV_USER_FALLBACK: SessionUser = {
  userId: 'dev-user',
  email: 'dev@localhost',
  name: 'Dev User',
  accessToken: '',
  refreshToken: '',
  idToken: '',
  expiresAt: 0,
};

/**
 * Refresh an authenticated user if their access token is expired.
 */
export async function getAuthenticatedUser(request: Request): Promise<SessionUser | null> {
  const user = await getSessionUser(request);
  if (!user) return null;
  if (user.expiresAt && Date.now() / 1000 > user.expiresAt - 60) {
    const refreshed = await refreshTokens(user.refreshToken);
    if (!refreshed) return null;

    // Update server-side token store
    await setTokens(user.userId, refreshed);

    return { ...user, ...refreshed };
  }
  return user;
}

async function clearInvalidAuthState(request: Request): Promise<string> {
  const session = await getSession(request);
  const cookieUser = session.get('user') as SessionUser | { userId?: string } | undefined;
  if (cookieUser?.userId) {
    await deleteTokens(cookieUser.userId);
  }
  return destroySession(session);
}

/**
 * Require an authenticated user for page loaders.
 * Redirects to /login if not authenticated.
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  if (!AUTH_ENABLED) return DEV_USER_FALLBACK;

  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw redirect('/login', {
      headers: { 'Set-Cookie': await clearInvalidAuthState(request) },
    });
  }
  return user;
}

/**
 * Require an authenticated user for API routes.
 * Returns 401 JSON instead of redirecting.
 */
export async function requireApiUser(request: Request): Promise<SessionUser> {
  if (!AUTH_ENABLED) return DEV_USER_FALLBACK;

  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': await clearInvalidAuthState(request),
      },
    });
  }

  return user;
}
