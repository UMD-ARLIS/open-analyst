import { approveSourceIngestBatch } from '~/lib/source-ingest.server';

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
  const batch = await approveSourceIngestBatch(
    params.projectId,
    params.batchId,
    new URL(request.url).origin
  );
  return Response.json({ batch });
}
