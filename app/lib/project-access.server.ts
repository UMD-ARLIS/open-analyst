import { redirect } from 'react-router';
import { requireApiUser, requireUser } from '~/lib/auth/require-user.server';
import type { SessionUser } from '~/lib/auth/session.server';
import { getProject, getProjectById } from '~/lib/db/queries/projects.server';
import { isTrustedInternalRequest } from '~/lib/internal-api.server';
import {
  hasProjectRole,
  type ProjectAccessRole,
} from '~/lib/db/queries/project-members.server';

function defaultMinimumRole(request: Request): ProjectAccessRole {
  return request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS'
    ? 'viewer'
    : 'editor';
}

export async function requireProjectApiAccess(
  request: Request,
  projectId: string,
  options?: { minimumRole?: ProjectAccessRole }
) {
  const minimumRole = options?.minimumRole || defaultMinimumRole(request);
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
    return { user: serviceUser, project, role: 'owner' as const };
  }

  const user = await requireApiUser(request);
  const project = await getProject(projectId, user.userId);
  if (!project) {
    throw new Response(JSON.stringify({ error: `Project not found: ${projectId}` }), {
      status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
  }
  const role = project.accessRole || 'viewer';
  if (!hasProjectRole(role, minimumRole)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return { user, project, role };
}

export async function requireProjectPageAccess(
  request: Request,
  projectId: string,
  redirectTo = '/',
  options?: { minimumRole?: ProjectAccessRole }
) {
  const minimumRole = options?.minimumRole || 'viewer';
  const user = await requireUser(request);
  const project = await getProject(projectId, user.userId);
  if (!project) {
    throw redirect(redirectTo);
  }
  const role = project.accessRole || 'viewer';
  if (!hasProjectRole(role, minimumRole)) {
    throw redirect(redirectTo);
  }
  return { user, project, role };
}
