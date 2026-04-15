import { listLogs } from '~/lib/logs.server';
import { requireApiUser } from '~/lib/auth/require-user.server';

export async function loader({ request }: { request: Request }) {
  const { userId } = await requireApiUser(request);
  const result = listLogs(userId);
  return Response.json(result);
}
