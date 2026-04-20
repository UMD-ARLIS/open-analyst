import { approveSourceIngestBatch } from '~/lib/source-ingest.server';
import { requireProjectApiAccess } from '~/lib/project-access.server';

export async function action({
  params,
  request,
}: {
  params: { projectId: string; batchId: string };
  request: Request;
}) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const { project } = await requireProjectApiAccess(request, params.projectId);
  const batch = await approveSourceIngestBatch(
    project,
    params.batchId,
    new URL(request.url).origin
  );
  return Response.json({ batch });
}
