import { updateCredential, deleteCredential } from '~/lib/credentials.server';
import { requireApiUser } from '~/lib/auth/require-user.server';
import { parseJsonBody } from '~/lib/request-utils';
import type { Route } from './+types/api.credentials.$id';

export async function action({ request, params }: Route.ActionArgs) {
  const { userId } = await requireApiUser(request);
  const id = params.id;

  if (request.method === 'PATCH') {
    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;
    const credential = updateCredential(id, body, userId);
    if (!credential) {
      return Response.json({ error: `Credential not found: ${id}` }, { status: 404 });
    }
    return Response.json({ credential });
  }

  if (request.method === 'DELETE') {
    deleteCredential(id, userId);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
