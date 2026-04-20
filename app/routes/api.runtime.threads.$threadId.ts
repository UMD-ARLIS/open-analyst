import { requireRuntimeThreadAccess, runtimeFetch, runtimeRequestHeaders } from '~/lib/runtime-proxy.server';

export async function loader({
  params,
  request,
}: {
  params: { threadId: string };
  request: Request;
}) {
  const { thread } = await requireRuntimeThreadAccess(request, params.threadId);
  return Response.json(thread);
}

export async function action({
  params,
  request,
}: {
  params: { threadId: string };
  request: Request;
}) {
  if (!['PATCH', 'DELETE'].includes(request.method)) {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireRuntimeThreadAccess(request, params.threadId, 'editor');
  const init: RequestInit = {
    method: request.method,
    headers: runtimeRequestHeaders(request, { Accept: 'application/json' }),
  };
  if (request.method === 'PATCH') {
    init.headers = runtimeRequestHeaders(request, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    init.body = await request.text();
  }
  const response = await runtimeFetch(`/threads/${encodeURIComponent(params.threadId)}`, init);
  if (request.method === 'DELETE') {
    if (!response.ok && response.status !== 204) {
      const body = await response.text();
      return Response.json(
        { error: body || `Thread delete failed with status ${response.status}` },
        { status: response.status }
      );
    }
    return new Response(null, { status: 204 });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return Response.json(payload, { status: response.status });
  }
  return Response.json(payload);
}
