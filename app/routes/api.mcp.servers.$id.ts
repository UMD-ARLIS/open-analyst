import { deleteMcpServer } from '~/lib/mcp.server';
import { requireApiUser } from '~/lib/auth/require-user.server';
import type { Route } from './+types/api.mcp.servers.$id';

export async function action({ request, params }: Route.ActionArgs) {
  const { userId } = await requireApiUser(request);
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  deleteMcpServer(params.id, userId);
  return Response.json({ success: true });
}
