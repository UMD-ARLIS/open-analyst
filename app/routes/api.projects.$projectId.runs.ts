import { ensureThreadForIntent, createRun, listRuns } from "~/lib/db/queries/runs.server";
import type { Route } from "./+types/api.projects.$projectId.runs";

export async function loader({ params }: Route.LoaderArgs) {
  const runs = await listRuns(params.projectId);
  return Response.json({ runs });
}

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const thread = await ensureThreadForIntent(
    params.projectId,
    prompt,
    typeof body.threadId === "string" ? body.threadId : undefined
  );
  const run = await createRun(params.projectId, {
    threadId: thread.id,
    title: prompt.slice(0, 500),
    mode: typeof body.mode === "string" ? body.mode : "chat",
    status: "queued",
    intent: prompt,
  });

  return Response.json({ run, thread });
}
