import { setSkillEnabled } from '~/lib/skills.server';
import { requireApiUser } from '~/lib/auth/require-user.server';
import { parseJsonBody } from '~/lib/request-utils';
import type { Route } from './+types/api.skills.$id.enabled';

export async function action({ request, params }: Route.ActionArgs) {
  const { userId } = await requireApiUser(request);
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const enabled = body.enabled !== false;
  const skill = setSkillEnabled(params.id, enabled, userId);
  if (!skill) {
    return Response.json({ error: `Skill not found: ${params.id}` }, { status: 404 });
  }
  return Response.json({ success: true, skill });
}
