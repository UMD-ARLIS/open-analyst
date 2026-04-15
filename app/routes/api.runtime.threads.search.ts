import {
  requireRuntimeProjectAccess,
  runtimeJson,
  runtimeRequestHeaders,
  type RuntimeThreadSummary,
} from '~/lib/runtime-proxy.server';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const metadata =
    body && typeof body === 'object' && body.metadata && typeof body.metadata === 'object'
      ? (body.metadata as Record<string, unknown>)
      : {};
  const projectId = typeof metadata.project_id === 'string' ? metadata.project_id.trim() : '';
  if (!projectId) {
    return Response.json({ error: 'metadata.project_id is required' }, { status: 400 });
  }

  await requireRuntimeProjectAccess(request, projectId);
  const payload = await runtimeJson<RuntimeThreadSummary[]>('/threads/search', {
    method: 'POST',
    headers: runtimeRequestHeaders(request, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return Response.json(payload);
}
