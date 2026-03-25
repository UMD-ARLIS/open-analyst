import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getSession, commitSession, type SessionUser } from '~/lib/auth/session.server';
import { handleCallback } from '~/lib/auth/keycloak.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  const state = session.get('oauth_state') as string | undefined;

  if (!state) {
    return redirect('/login');
  }

  try {
    const result = await handleCallback(request.url, { state });

    const user: SessionUser = {
      userId: result.userId,
      email: result.email,
      name: result.name,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      idToken: result.idToken,
      expiresAt: result.expiresAt,
    };

    session.set('user', user);
    session.unset('oauth_state');

    return redirect('/', {
      headers: { 'Set-Cookie': await commitSession(session) },
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    return redirect('/login');
  }
}
