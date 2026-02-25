import { createProjectStore } from "~/lib/project-store.server";
import { loadConfig } from "~/lib/config.server";
import { createAgentProvider } from "~/lib/agent/index.server";
import { getProjectWorkspace } from "~/lib/filesystem.server";
import type { Route } from "./+types/api.chat.stream";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const cfg = loadConfig();
  const projectId = String(
    body.projectId || cfg.activeProjectId || ""
  ).trim();

  if (!projectId) {
    return Response.json(
      {
        error:
          "No active project configured. Create/select a project first.",
      },
      { status: 400 }
    );
  }

  const provider = createAgentProvider(cfg);
  const workingDir = getProjectWorkspace(projectId);
  const store = createProjectStore();
  const prompt = String(body.prompt || "").trim();
  const run = store.createRun(projectId, {
    type: "chat",
    status: "running",
    prompt,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        for await (const event of provider.stream(
          Array.isArray(body.messages) ? body.messages : [],
          {
            projectId,
            workingDir,
            collectionId: String(body.collectionId || "").trim() || undefined,
            collectionName:
              String(body.collectionName || "").trim() || "Task Sources",
            deepResearch: body.deepResearch === true,
          }
        )) {
          send(event.type, event);
          store.appendRunEvent(projectId, run.id, event.type, {
            text: event.text,
            toolName: event.toolName,
            toolStatus: event.toolStatus,
            error: event.error,
          });
        }
        send("done", { runId: run.id });
        store.updateRun(projectId, run.id, { status: "completed" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", { error: msg });
        store.updateRun(projectId, run.id, { status: "failed", output: msg });
      } finally {
        await provider.dispose?.();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
