import { rejectSourceIngestBatch } from "~/lib/source-ingest.server";

export async function action({
  params,
  request,
}: {
  params: { projectId: string; batchId: string };
  request: Request;
}) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const batch = await rejectSourceIngestBatch(params.projectId, params.batchId);
  return Response.json({ batch });
}
