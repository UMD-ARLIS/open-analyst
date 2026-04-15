import { listMcpServers, saveMcpServer } from '~/lib/mcp.server';
import { requireApiUser } from '~/lib/auth/require-user.server';
import { parseJsonBody } from '~/lib/request-utils';
import type { Route } from './+types/api.mcp.servers';

export async function loader({ request }: Route.LoaderArgs) {
  const { userId } = await requireApiUser(request);
  return Response.json({ servers: listMcpServers(userId) });
}

export async function action({ request }: Route.ActionArgs) {
  const { userId } = await requireApiUser(request);
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const server = saveMcpServer(body, userId);
  return Response.json({ server });
}
