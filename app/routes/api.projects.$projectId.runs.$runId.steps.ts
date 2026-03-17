import { getRun, listRunSteps } from "~/lib/db/queries/runs.server";
import type { Route } from "./+types/api.projects.$projectId.runs.$runId.steps";

export async function loader({ params }: Route.LoaderArgs) {
  const run = await getRun(params.runId);
  if (!run || run.projectId !== params.projectId) {
    return Response.json({ error: `Run not found: ${params.runId}` }, { status: 404 });
  }
  const steps = await listRunSteps(run.id);
  return Response.json({ steps });
}
