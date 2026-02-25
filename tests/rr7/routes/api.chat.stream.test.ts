import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import { createProjectStore } from "~/lib/project-store.server";

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
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
    const store = createProjectStore();
    store.createProject({ name: "Test Project" });
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("returns text/event-stream content type", async () => {
    const store = createProjectStore();
    const projects = store.listProjects();
    const projectId = projects[0].id;

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

  it("returns 400 when no projectId", async () => {
    const response = await action({
      request: makeRequest({ messages: [] }),
      params: {},
      context: {},
    });
    expect(response.status).toBe(400);
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

  it("creates Run record", async () => {
    const store = createProjectStore();
    const projects = store.listProjects();
    const projectId = projects[0].id;

    const response = await action({
      request: makeRequest({
        projectId,
        messages: [{ role: "user", content: "hello" }],
        prompt: "hello",
      }),
      params: {},
      context: {},
    });

    // Consume the stream to trigger run creation events
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    const runs = store.listRuns(projectId);
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs[0].type).toBe("chat");
  });
});
