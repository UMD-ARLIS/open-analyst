import { createProjectStore } from "~/lib/project-store.server";
import type { Route } from "./+types/api.projects.$projectId.runs.$runId";

export async function loader({ params }: Route.LoaderArgs) {
  const store = createProjectStore();
  const run = store.getRun(params.projectId, params.runId);
  if (!run) {
    return Response.json(
      { error: `Run not found: ${params.runId}` },
      { status: 404 }
    );
  }
  return Response.json({ run });
}
