import { listCollections, createCollection } from '~/lib/db/queries/documents.server';
import { requireProjectApiAccess } from '~/lib/project-access.server';
import { parseJsonBody } from '~/lib/request-utils';
import type { Route } from './+types/api.projects.$projectId.collections';

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireProjectApiAccess(request, params.projectId);
  const collections = await listCollections(params.projectId);
  return Response.json({ collections });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  await requireProjectApiAccess(request, params.projectId);
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const collection = await createCollection(params.projectId, {
    name: body.name,
    description: body.description,
  });
  return Response.json({ collection }, { status: 201 });
}
