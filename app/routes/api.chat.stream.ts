import { getSettings } from "~/lib/db/queries/settings.server";
import { createTask, updateTask, appendTaskEvent } from "~/lib/db/queries/tasks.server";
import { createAgentProvider } from "~/lib/agent/index.server";
import { getProjectWorkspace } from "~/lib/filesystem.server";
import type { HeadlessConfig } from "~/lib/types";
import type { Route } from "./+types/api.chat.stream";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const settings = await getSettings();
  const projectId = String(
    body.projectId || settings.activeProjectId || ""
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

  // Build a minimal HeadlessConfig for the agent provider
  const cfg: HeadlessConfig = {
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    bedrockRegion: "us-east-1",
    model: settings.model,
    openaiMode: "chat",
    workingDir: settings.workingDir || process.cwd(),
    workingDirType: settings.workingDirType,
    s3Uri: settings.s3Uri || "",
    activeProjectId: projectId,
    agentBackend: settings.agentBackend,
  };

  const provider = createAgentProvider(cfg);
  const workingDir = getProjectWorkspace(projectId);
  const prompt = String(body.prompt || "").trim();
  const task = await createTask(projectId, {
    title: prompt.slice(0, 500) || "New Task",
    type: "chat",
    status: "running",
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
          await appendTaskEvent(task.id, event.type, {
            text: event.text,
            toolName: event.toolName,
            toolStatus: event.toolStatus,
            error: event.error,
          });
        }
        send("done", { runId: task.id });
        await updateTask(task.id, { status: "completed" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", { error: msg });
        await updateTask(task.id, { status: "failed" });
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
