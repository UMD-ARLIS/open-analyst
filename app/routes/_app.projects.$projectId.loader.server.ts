import { upsertSettings } from '~/lib/db/queries/settings.server';
import { requireProjectPageAccess } from '~/lib/project-access.server';
import { buildWorkspaceContext } from '~/lib/workspace-context.server';

export async function loader({
  params,
  request,
}: {
  params: { projectId: string };
  request: Request;
}) {
  const { user } = await requireProjectPageAccess(request, params.projectId);
  await upsertSettings({ activeProjectId: params.projectId }, user.userId);
  const workspaceContext = await buildWorkspaceContext(params.projectId, user.userId);
  return { projectId: params.projectId, workspaceContext };
}
