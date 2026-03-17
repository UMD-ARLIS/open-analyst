import { getRun, updateRun } from "~/lib/db/queries/runs.server";
import type { Route } from "./+types/api.projects.$projectId.runs.$runId.interrupt";

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const run = await getRun(params.runId);
  if (!run || run.projectId !== params.projectId) {
    return Response.json({ error: `Run not found: ${params.runId}` }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const interrupted = await updateRun(run.id, {
    status: "cancelled",
    runtimeState: {
      ...(run.runtimeState && typeof run.runtimeState === "object"
        ? (run.runtimeState as Record<string, unknown>)
        : {}),
      interruptedAt: new Date().toISOString(),
      reason: typeof body.reason === "string" ? body.reason : "user_interrupt",
    },
    completedAt: new Date(),
  });
  return Response.json({ run: interrupted });
}
