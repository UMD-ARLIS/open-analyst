import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getSession, getSessionUser, destroySession } from '~/lib/auth/session.server';
import { getLogoutUrl } from '~/lib/auth/keycloak.server';
import { deleteTokens } from '~/lib/auth/token-store.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  const session = await getSession(request);
  const idToken = user?.idToken || '';

  const headers = new Headers();
  headers.set('Set-Cookie', await destroySession(session));

  if (user?.userId) {
    await deleteTokens(user.userId);
  }

  if (idToken) {
    return redirect(getLogoutUrl(idToken), { headers });
  }

  return redirect('/login', { headers });
}
