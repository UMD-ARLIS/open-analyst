import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import {
  getSession,
  commitSession,
  type SessionCookieUser,
} from '~/lib/auth/session.server';
import { handleCallback } from '~/lib/auth/keycloak.server';
import { setTokens } from '~/lib/auth/token-store.server';
import { upsertAppUser } from '~/lib/db/queries/app-users.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  const state = session.get('oauth_state') as string | undefined;

  if (!state) {
    return redirect('/login');
  }

  try {
    const result = await handleCallback(request.url, { state });

    // Store tokens server-side to avoid cookie size limits
    await setTokens(result.userId, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      idToken: result.idToken,
      expiresAt: result.expiresAt,
    });
    await upsertAppUser({
      userId: result.userId,
      email: result.email,
      name: result.name,
      username: result.username,
    });

    // Only store minimal user info in the cookie
    const cookieUser: SessionCookieUser = {
      userId: result.userId,
      email: result.email,
      name: result.name,
    };

    session.set('user', cookieUser);
    session.unset('oauth_state');

    return redirect('/', {
      headers: { 'Set-Cookie': await commitSession(session) },
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    return redirect('/login');
  }
}
