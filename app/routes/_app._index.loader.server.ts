import { redirect } from 'react-router';
import { getSettings } from '~/lib/db/queries/settings.server';
import { getProject } from '~/lib/db/queries/projects.server';
import { requireUser } from '~/lib/auth/require-user.server';

export async function loader({ request }: { request: Request }) {
  const { userId } = await requireUser(request);
  const settings = await getSettings(userId);
  if (settings.activeProjectId) {
    const project = await getProject(settings.activeProjectId, userId);
    if (project) {
      throw redirect(`/projects/${project.id}`);
    }
  }
  return { noProjects: true };
}
