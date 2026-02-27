import { describe, it, expect, vi, beforeAll } from "vitest";
import { createProject } from "~/lib/db/queries/projects.server";

// Mock the agent provider before importing the route
vi.mock("~/lib/agent/index.server", () => ({
  createAgentProvider: () => ({
    name: "mock",
    async *stream() {
      yield {
        type: "text_delta" as const,
        text: "Hello from stream",
        timestamp: Date.now(),
      };
      yield { type: "agent_end" as const, timestamp: Date.now() };
    },
    async dispose() {},
  }),
}));

import { action } from "~/routes/api.chat.stream";

let projectId: string;

beforeAll(async () => {
  const project = await createProject({ name: "Chat Stream Test" });
  projectId = project.id;
});

function makeRequest(
  body: Record<string, unknown>,
  method = "POST"
): Request {
  return new Request("http://localhost/api/chat/stream", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/chat/stream", () => {
  it("returns text/event-stream content type", async () => {
    const response = await action({
      request: makeRequest({
        projectId,
        messages: [{ role: "user", content: "hello" }],
        prompt: "hello",
      }),
      params: {},
      context: {},
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("returns 400 when no projectId and no active project", async () => {
    // Mock getSettings to return no active project
    const settingsMod = await import("~/lib/db/queries/settings.server");
    const spy = vi.spyOn(settingsMod, "getSettings").mockResolvedValue({
      activeProjectId: null,
      model: "bedrock-claude-opus-4.6",
      workingDir: "",
      workingDirType: "local",
      s3Uri: null,
      agentBackend: "strands",
      devLogsEnabled: false,
    });

    const response = await action({
      request: makeRequest({ messages: [] }),
      params: {},
      context: {},
    });
    expect(response.status).toBe(400);
    spy.mockRestore();
  });

  it("returns 405 for non-POST", async () => {
    const response = await action({
      request: new Request("http://localhost/api/chat/stream", {
        method: "GET",
      }),
      params: {},
      context: {},
    });
    expect(response.status).toBe(405);
  });

  it("creates Task record", async () => {
    const response = await action({
      request: makeRequest({
        projectId,
        messages: [{ role: "user", content: "hello" }],
        prompt: "hello",
      }),
      params: {},
      context: {},
    });

    // Consume the stream to trigger task creation events
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    const { listTasks } = await import("~/lib/db/queries/tasks.server");
    const tasks = await listTasks(projectId);
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].type).toBe("chat");
  });
});
