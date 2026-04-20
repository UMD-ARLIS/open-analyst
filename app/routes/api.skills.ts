import { listRuntimeSkills } from '~/lib/runtime-skills.server';
import { requireApiUser } from '~/lib/auth/require-user.server';

export async function loader({ request }: { request: Request }) {
  const { userId } = await requireApiUser(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') || undefined;
  return Response.json({ skills: await listRuntimeSkills({ userId, projectId }) });
}
