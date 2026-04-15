import { redirect } from 'react-router';
import { requireApiUser, requireUser } from '~/lib/auth/require-user.server';
import { getProject } from '~/lib/db/queries/projects.server';

export async function requireProjectApiAccess(request: Request, projectId: string) {
  const user = await requireApiUser(request);
  const project = await getProject(projectId, user.userId);
  if (!project) {
    throw new Response(JSON.stringify({ error: `Project not found: ${projectId}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return { user, project };
}

export async function requireProjectPageAccess(
  request: Request,
  projectId: string,
  redirectTo = '/'
) {
  const user = await requireUser(request);
  const project = await getProject(projectId, user.userId);
  if (!project) {
    throw redirect(redirectTo);
  }
  return { user, project };
}
