import { requireRuntimeThreadAccess, runtimeJson, runtimeRequestHeaders } from '~/lib/runtime-proxy.server';

export async function action({
  params,
  request,
}: {
  params: { threadId: string };
  request: Request;
}) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireRuntimeThreadAccess(request, params.threadId, 'editor');
  const body = await request.text();
  const payload = await runtimeJson<{ run_id: string; thread_id: string; status: string }>(
    `/threads/${encodeURIComponent(params.threadId)}/runs`,
    {
      method: 'POST',
      headers: runtimeRequestHeaders(request, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body,
    }
  );
  return Response.json(payload, { status: 201 });
}
