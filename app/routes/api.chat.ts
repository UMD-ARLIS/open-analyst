import { createProjectStore } from "~/lib/project-store.server";
import { loadConfig } from "~/lib/config.server";
import { getProjectWorkspace } from "~/lib/filesystem.server";
import type { Route } from "./+types/api.chat";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const cfg = loadConfig();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const prompt = String(body.prompt || "").trim();
  const projectId = String(
    body.projectId || cfg.activeProjectId || ""
  ).trim();
  const collectionId = String(body.collectionId || "").trim();
  const collectionName = String(body.collectionName || "").trim();
  const deepResearch = body.deepResearch === true;

  if (!projectId) {
    return Response.json(
      {
        error:
          "No active project configured. Create/select a project first.",
      },
      { status: 400 }
    );
  }

  // Ensure workspace directory exists for this project
  getProjectWorkspace(projectId);

  const store = createProjectStore();
  const chatMessages = messages.length
    ? messages
    : [{ role: "user", content: prompt }];
  const run = store.createRun(projectId, {
    type: "chat",
    status: "running",
    prompt,
  });
  store.appendRunEvent(projectId, run.id, "chat_requested", {
    messageCount: chatMessages.length,
  });

  try {
    const { runAgentChat } = await import("~/lib/chat.server");
    const result = await runAgentChat(cfg, chatMessages, {
      projectId,
      collectionId: collectionId || undefined,
      collectionName: collectionName || "Task Sources",
      deepResearch,
      onRunEvent: (eventType: string, payload: Record<string, unknown>) => {
        store.appendRunEvent(projectId, run.id, eventType, payload);
      },
    });
    store.updateRun(projectId, run.id, {
      status: "completed",
      output: result.text || "",
    });
    store.appendRunEvent(projectId, run.id, "chat_completed", {
      traceCount: Array.isArray(result.traces) ? result.traces.length : 0,
    });
    return Response.json({
      ok: true,
      text: result.text,
      traces: result.traces || [],
      runId: run.id,
      projectId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store.appendRunEvent(projectId, run.id, "chat_failed", { error: msg });
    store.updateRun(projectId, run.id, {
      status: "failed",
      output: msg,
    });
    return Response.json({ error: msg }, { status: 500 });
  }
}
