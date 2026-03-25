import { redirect } from 'react-router';
import { requireUser } from '~/lib/auth/require-user.server';
import { getProject } from '~/lib/db/queries/projects.server';
import { upsertSettings } from '~/lib/db/queries/settings.server';
import { buildWorkspaceContext } from '~/lib/workspace-context.server';

export async function loader({
  params,
  request,
}: {
  params: { projectId: string };
  request: Request;
}) {
  const { userId } = await requireUser(request);
  const project = await getProject(params.projectId);
  if (!project) {
    throw redirect('/');
  }
  await upsertSettings({ activeProjectId: params.projectId }, userId);
  const workspaceContext = await buildWorkspaceContext(params.projectId);
  return { projectId: params.projectId, workspaceContext };
}
