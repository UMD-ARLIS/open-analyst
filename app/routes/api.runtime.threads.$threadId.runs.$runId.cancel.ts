import { requireRuntimeThreadAccess, runtimeJson, runtimeRequestHeaders } from '~/lib/runtime-proxy.server';

export async function action({
  params,
  request,
}: {
  params: { threadId: string; runId: string };
  request: Request;
}) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireRuntimeThreadAccess(request, params.threadId, 'editor');
  const payload = await runtimeJson<{ ok: boolean }>(
    `/threads/${encodeURIComponent(params.threadId)}/runs/${encodeURIComponent(params.runId)}/cancel`,
    {
      method: 'POST',
      headers: runtimeRequestHeaders(request, { Accept: 'application/json' }),
    }
  );
  return Response.json(payload);
}
