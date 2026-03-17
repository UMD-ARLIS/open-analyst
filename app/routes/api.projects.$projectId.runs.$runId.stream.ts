import { buildRuntimeProjectContext } from "~/lib/project-runtime.server";
import { streamRuntime } from "~/lib/runtime-client.server";
import {
  appendRunStep,
  getRun,
  updateRun,
} from "~/lib/db/queries/runs.server";
import { createEvidenceItem, listEvidenceItems } from "~/lib/db/queries/evidence.server";
import type { Route } from "./+types/api.projects.$projectId.runs.$runId.stream";

type RuntimeStreamEvent = {
  type: string;
  text?: string;
  phase?: string;
  status?: string;
  actor?: string;
  plan?: Array<Record<string, unknown>>;
  evidence?: Array<Record<string, unknown>>;
  error?: string;
};

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function persistRuntimeEvent(runId: string, projectId: string, event: RuntimeStreamEvent) {
  const actor = String(event.actor || "supervisor");
  if (event.type === "plan") {
    await appendRunStep(runId, {
      stepType: "plan",
      actor,
      title: event.text || "Plan ready",
      status: "completed",
      payload: { phase: event.phase, plan: event.plan || [] },
      startedAt: new Date(),
      completedAt: new Date(),
    });
    await updateRun(runId, { plan: event.plan || [] });
    return;
  }

  if (event.type === "evidence" && Array.isArray(event.evidence)) {
    const existing = await listEvidenceItems(projectId, { runId });
    if (existing.length === 0) {
      for (const item of event.evidence) {
        await createEvidenceItem(projectId, {
          runId,
          title: typeof item.title === "string" ? item.title : "Evidence",
          evidenceType: typeof item.evidence_type === "string" ? item.evidence_type : "note",
          sourceUri: typeof item.source_uri === "string" ? item.source_uri : undefined,
          citationText: typeof item.citation_text === "string" ? item.citation_text : undefined,
          extractedText: typeof item.extracted_text === "string" ? item.extracted_text : undefined,
          confidence: typeof item.confidence === "string" ? item.confidence : undefined,
          provenance: item.provenance && typeof item.provenance === "object"
            ? (item.provenance as Record<string, unknown>)
            : {},
          metadata: item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Record<string, unknown>)
            : {},
        });
      }
    }
    await appendRunStep(runId, {
      stepType: "evidence",
      actor,
      title: event.text || "Evidence updated",
      status: "completed",
      payload: { phase: event.phase, evidence: event.evidence },
      startedAt: new Date(),
      completedAt: new Date(),
    });
    return;
  }

  if (event.type === "draft") {
    await appendRunStep(runId, {
      stepType: "draft",
      actor,
      title: "Draft prepared",
      status: "completed",
      payload: { phase: event.phase, text: event.text || "" },
      startedAt: new Date(),
      completedAt: new Date(),
    });
    return;
  }

  if (event.type === "status") {
    await appendRunStep(runId, {
      stepType: "status",
      actor,
      title: event.text || event.phase || "Run update",
      status: event.status === "completed" ? "completed" : "running",
      payload: { phase: event.phase || "", status: event.status || "running" },
      startedAt: new Date(),
      completedAt: event.status === "completed" ? new Date() : null,
    });
  }
}

export async function loader({ params }: Route.LoaderArgs) {
  const run = await getRun(params.runId);
  if (!run || run.projectId !== params.projectId) {
    return Response.json({ error: `Run not found: ${params.runId}` }, { status: 404 });
  }

  if (run.status === "completed") {
    const stream = new ReadableStream({
      start(controller) {
        if (run.latestOutput) {
          controller.enqueue(sseChunk("text_delta", { text: run.latestOutput }));
        }
        controller.enqueue(sseChunk("run_completed", { text: "Run complete", status: "completed" }));
        controller.enqueue(sseChunk("done", { runId: run.id }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const project = await buildRuntimeProjectContext(params.projectId);
  const runtimeResponse = await streamRuntime({
    run_id: run.id,
    thread_id: run.threadId,
    mode: run.mode || "chat",
    prompt: run.intent || run.title || "Untitled run",
    messages: [{ role: "user", content: run.intent || run.title || "Untitled run" }],
    project,
    stream: true,
  });

  await updateRun(run.id, {
    status: "running",
    startedAt: run.startedAt || new Date(),
  });

  const stream = new ReadableStream({
    async start(controller) {
      const reader = runtimeResponse.body?.getReader();
      if (!reader) {
        controller.enqueue(sseChunk("error", { error: "Runtime stream missing body" }));
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalText = "";
      let currentEvent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
              continue;
            }
            if (!line.startsWith("data: ") || !currentEvent) continue;

            const raw = line.slice(6);
            let parsed: RuntimeStreamEvent;
            try {
              parsed = JSON.parse(raw) as RuntimeStreamEvent;
            } catch {
              currentEvent = "";
              continue;
            }
            parsed.type = currentEvent;

            if (currentEvent === "text_delta" && parsed.text) {
              finalText += parsed.text;
            }

            await persistRuntimeEvent(run.id, params.projectId, parsed);
            controller.enqueue(sseChunk(currentEvent, parsed));
            currentEvent = "";
          }
        }

        await updateRun(run.id, {
          status: "completed",
          latestOutput: finalText,
          completedAt: new Date(),
          runtimeState: {
            ...(run.runtimeState && typeof run.runtimeState === "object"
              ? (run.runtimeState as Record<string, unknown>)
              : {}),
            streamedAt: new Date().toISOString(),
          },
        });

        controller.enqueue(sseChunk("done", { runId: run.id }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateRun(run.id, {
          status: "failed",
          latestOutput: finalText,
          completedAt: new Date(),
          runtimeState: {
            ...(run.runtimeState && typeof run.runtimeState === "object"
              ? (run.runtimeState as Record<string, unknown>)
              : {}),
            error: message,
          },
        });
        controller.enqueue(sseChunk("error", { error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
