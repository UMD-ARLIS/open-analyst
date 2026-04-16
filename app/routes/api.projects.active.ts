import { upsertSettings } from '~/lib/db/queries/settings.server';
import { requireProjectApiAccess } from '~/lib/project-access.server';
import { parseJsonBody } from '~/lib/request-utils';
import type { Route } from './+types/api.projects.active';

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const projectId = String(body.projectId || '').trim();
  if (!projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 });
  }
  const { user } = await requireProjectApiAccess(request, projectId, { minimumRole: 'viewer' });
  await upsertSettings({ activeProjectId: projectId }, user.userId);
  return Response.json({ success: true, activeProjectId: projectId });
}
