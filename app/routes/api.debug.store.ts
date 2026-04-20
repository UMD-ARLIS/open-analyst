import { listProjects } from '~/lib/db/queries/projects.server';
import { getSettings } from '~/lib/db/queries/settings.server';
import { requireApiUser } from '~/lib/auth/require-user.server';

export async function loader({ request }: { request: Request }) {
  const { userId } = await requireApiUser(request);
  const [projects, settings] = await Promise.all([listProjects(userId), getSettings(userId)]);
  const debug = { projects, settings };
  return new Response(JSON.stringify(debug, null, 2), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
