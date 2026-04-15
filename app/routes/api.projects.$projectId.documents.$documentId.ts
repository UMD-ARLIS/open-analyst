import { getDocument, deleteDocument } from '~/lib/db/queries/documents.server';
import { deleteArtifact } from '~/lib/artifacts.server';
import { requireProjectApiAccess } from '~/lib/project-access.server';
import { resolveProjectArtifactConfig } from '~/lib/project-storage.server';

export async function action({
  params,
  request,
}: {
  params: { projectId: string; documentId: string };
  request: Request;
}) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const { project } = await requireProjectApiAccess(request, params.projectId);

  const doc = await getDocument(params.projectId, params.documentId);
  if (!doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  await deleteDocument(params.projectId, params.documentId);

  if (doc.storageUri) {
    try {
      const storage = resolveProjectArtifactConfig(project);
      await deleteArtifact({
        storageUri: doc.storageUri,
        region: storage.region,
        endpoint: storage.endpoint,
      });
    } catch {
      // Storage cleanup is best-effort
    }
  }

  return Response.json({ success: true });
}
