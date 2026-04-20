import { findAppUserByIdentifier } from '~/lib/db/queries/app-users.server';
import {
  listProjectMembers,
  upsertProjectMember,
} from '~/lib/db/queries/project-members.server';
import { requireProjectApiAccess } from '~/lib/project-access.server';
import { parseJsonBody } from '~/lib/request-utils';
import type { Route } from './+types/api.projects.$projectId.members';

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireProjectApiAccess(request, params.projectId);
  const members = await listProjectMembers(params.projectId);
  return Response.json({ members });
}

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const { user, project } = await requireProjectApiAccess(request, params.projectId, {
    minimumRole: 'owner',
  });
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const identifier = String(body.identifier || '').trim();
  if (!identifier) {
    return Response.json({ error: 'identifier is required' }, { status: 400 });
  }

  const targetUser = await findAppUserByIdentifier(identifier);
  if (!targetUser) {
    return Response.json(
      {
        error:
          'User not found. The user must sign in at least once before they can be added to a project.',
      },
      { status: 404 }
    );
  }

  if (targetUser.userId === project.userId) {
    const members = await listProjectMembers(params.projectId);
    return Response.json({
      member: members.find((member) => member.userId === targetUser.userId) || null,
      members,
    });
  }

  const role = String(body.role || 'editor').trim().toLowerCase() === 'viewer' ? 'viewer' : 'editor';
  const member = await upsertProjectMember(params.projectId, targetUser.userId, role, user.userId);
  const members = await listProjectMembers(params.projectId);
  return Response.json({ member, members }, { status: 201 });
}
