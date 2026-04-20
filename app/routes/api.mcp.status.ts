import { getMcpStatus } from '~/lib/mcp.server';
import { requireApiUser } from '~/lib/auth/require-user.server';

export async function loader({ request }: { request: Request }) {
  const { userId } = await requireApiUser(request);
  return Response.json({ statuses: await getMcpStatus(userId) });
}
