import { createProjectStore } from "~/lib/project-store.server";
import type { Route } from "./+types/api.projects.$projectId.runs";

export async function loader({ params }: Route.LoaderArgs) {
  const store = createProjectStore();
  return Response.json({ runs: store.listRuns(params.projectId) });
}
