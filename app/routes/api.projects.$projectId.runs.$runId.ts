import { getRun, listApprovals, getThread } from "~/lib/db/queries/runs.server";
import type { Route } from "./+types/api.projects.$projectId.runs.$runId";

export async function loader({ params }: Route.LoaderArgs) {
  const run = await getRun(params.runId);
  if (!run || run.projectId !== params.projectId) {
    return Response.json({ error: `Run not found: ${params.runId}` }, { status: 404 });
  }
  const [thread, approvals] = await Promise.all([
    run.threadId ? getThread(run.threadId) : Promise.resolve(undefined),
    listApprovals(run.id),
  ]);
  return Response.json({ run, thread: thread || null, approvals });
}
