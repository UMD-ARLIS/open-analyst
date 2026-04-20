import { requireRuntimeThreadAccess, runtimeJson, runtimeRequestHeaders } from '~/lib/runtime-proxy.server';

export async function loader({
  params,
  request,
}: {
  params: { threadId: string; runId: string };
  request: Request;
}) {
  await requireRuntimeThreadAccess(request, params.threadId);
  const payload = await runtimeJson<Record<string, unknown>>(
    `/threads/${encodeURIComponent(params.threadId)}/runs/${encodeURIComponent(params.runId)}`,
    {
      headers: runtimeRequestHeaders(request),
    }
  );
  return Response.json(payload);
}
