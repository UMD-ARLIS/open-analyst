import { redirect } from 'react-router';
import { normalizeUuid } from '~/lib/uuid';
import { buildWorkspaceContext } from '~/lib/workspace-context.server';
import { requireProjectPageAccess } from '~/lib/project-access.server';
import { runtimeJson, type RuntimeThreadSummary } from '~/lib/runtime-proxy.server';

function normalizeAnalysisMode(value: unknown): 'chat' | 'research' | 'product' {
  const mode = String(value || '')
    .trim()
    .toLowerCase();
  if (mode === 'product') return 'product';
  if (mode === 'research') return 'research';
  return 'chat';
}

export async function loader({
  params,
  request,
}: {
  params: { projectId: string; threadId: string };
  request: Request;
}) {
  const { user } = await requireProjectPageAccess(request, params.projectId, `/projects/${params.projectId}`);
  const workspaceContext = await buildWorkspaceContext(params.projectId, user.userId);
  try {
    const thread = await runtimeJson<RuntimeThreadSummary>(
      `/threads/${encodeURIComponent(params.threadId)}`
    );
    const metadata =
      thread.metadata && typeof thread.metadata === 'object' ? thread.metadata : {};
    if (!metadata.project_id || metadata.project_id !== params.projectId) {
      throw redirect(`/projects/${params.projectId}`);
    }
    return {
      projectId: params.projectId,
      threadId: params.threadId,
      workspaceContext,
      threadMetadata: {
        collectionId: normalizeUuid(metadata.collection_id),
        analysisMode: normalizeAnalysisMode(metadata.analysis_mode),
      },
    };
  } catch (error) {
    if (error instanceof Response && error.status === 404) {
      throw redirect(`/projects/${params.projectId}`);
    }
    if (error instanceof Response) throw error;
    return {
      projectId: params.projectId,
      threadId: params.threadId,
      workspaceContext,
      threadMetadata: {
        collectionId: null,
        analysisMode: 'chat' as const,
      },
      threadLoadError: error instanceof Error ? error.message : String(error),
    };
  }
}
