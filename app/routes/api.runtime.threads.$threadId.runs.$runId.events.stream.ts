import {
  passthroughHeaders,
  requireRuntimeThreadAccess,
  runtimeFetch,
  runtimeRequestHeaders,
} from '~/lib/runtime-proxy.server';

export async function loader({
  params,
  request,
}: {
  params: { threadId: string; runId: string };
  request: Request;
}) {
  await requireRuntimeThreadAccess(request, params.threadId);
  const incoming = new URL(request.url);
  const target = new URL(
    `/threads/${encodeURIComponent(params.threadId)}/runs/${encodeURIComponent(params.runId)}/events/stream`,
    'http://runtime.local'
  );
  const after = incoming.searchParams.get('after');
  if (after) target.searchParams.set('after', after);

  const response = await runtimeFetch(`${target.pathname}${target.search}`, {
    timeoutMs: null,
    headers: runtimeRequestHeaders(request, {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    }),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    return Response.json(
      { error: body || `Stream request failed with status ${response.status}` },
      { status: response.status }
    );
  }

  return new Response(response.body, {
    status: response.status,
    headers: passthroughHeaders(response, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    }),
  });
}
