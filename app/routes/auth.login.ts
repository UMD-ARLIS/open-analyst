import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { randomUUID } from 'crypto';
import { getSession, commitSession } from '~/lib/auth/session.server';
import { getAuthorizationUrl } from '~/lib/auth/keycloak.server';

export async function action({ request }: ActionFunctionArgs) {
  const state = randomUUID();
  const session = await getSession(request);
  session.set('oauth_state', state);

  const authUrl = await getAuthorizationUrl(state);

  return redirect(authUrl, {
    headers: { 'Set-Cookie': await commitSession(session) },
  });
}
