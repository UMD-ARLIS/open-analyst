import {
  getProjectMember,
  listProjectMembers,
  removeProjectMember,
  upsertProjectMember,
} from '~/lib/db/queries/project-members.server';
import { requireProjectApiAccess } from '~/lib/project-access.server';
import { parseJsonBody } from '~/lib/request-utils';
import type { Route } from './+types/api.projects.$projectId.members.$memberUserId';

export async function action({ params, request }: Route.ActionArgs) {
  const { user } = await requireProjectApiAccess(request, params.projectId, {
    minimumRole: 'owner',
  });
  const memberUserId = String(params.memberUserId || '').trim();
  if (!memberUserId) {
    return Response.json({ error: 'memberUserId is required' }, { status: 400 });
  }

  const member = await getProjectMember(params.projectId, memberUserId);
  if (!member) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }
  if (member.isOwner) {
    return Response.json({ error: 'Project owner cannot be modified here' }, { status: 400 });
  }

  if (request.method === 'PATCH') {
    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;
    const role =
      String(body.role || '').trim().toLowerCase() === 'viewer' ? 'viewer' : 'editor';
    const updated = await upsertProjectMember(params.projectId, memberUserId, role, user.userId);
    const members = await listProjectMembers(params.projectId);
    return Response.json({ member: updated, members });
  }

  if (request.method === 'DELETE') {
    await removeProjectMember(params.projectId, memberUserId);
    const members = await listProjectMembers(params.projectId);
    return Response.json({ success: true, members });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
