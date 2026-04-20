import { clearLogs } from '~/lib/logs.server';
import { requireApiUser } from '~/lib/auth/require-user.server';
import type { Route } from './+types/api.logs.clear';

export async function action({ request }: Route.ActionArgs) {
  const { userId } = await requireApiUser(request);
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const result = clearLogs(userId);
  return Response.json(result);
}
