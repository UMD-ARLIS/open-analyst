import { redirect } from 'react-router';
import { requireApiUser, requireUser } from '~/lib/auth/require-user.server';
import type { SessionUser } from '~/lib/auth/session.server';
import { getProject, getProjectById } from '~/lib/db/queries/projects.server';
import { isTrustedInternalRequest } from '~/lib/internal-api.server';

export async function requireProjectApiAccess(request: Request, projectId: string) {
  if (isTrustedInternalRequest(request)) {
    const project = await getProjectById(projectId);
    if (!project) {
      throw new Response(JSON.stringify({ error: `Project not found: ${projectId}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const serviceUser: SessionUser = {
      userId: project.userId,
      email: '',
      name: 'Internal Service',
      accessToken: '',
      refreshToken: '',
      idToken: '',
      expiresAt: 0,
    };
    return { user: serviceUser, project };
  }

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
