import { describe, expect, it, vi } from "vitest";
import * as runtimeContext from "~/lib/runtime-context.server";
import { action } from "~/routes/api.runtime.$";

describe("POST /api/runtime/*", () => {
  it("injects server-built project runtime context into JSON run requests", async () => {
    vi.spyOn(runtimeContext, "buildRuntimeConfigurable").mockResolvedValue({
      project_id: "project-123",
      workspace_path: "/tmp/workspace",
      api_base_url: "http://localhost",
      collection_id: "collection-456",
      analysis_mode: "deep_research",
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await action({
      request: new Request("http://localhost/api/runtime/threads/thread-1/runs/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            messages: [{ role: "human", content: "Research this topic." }],
          },
          config: {
            configurable: {
              project_id: "project-123",
              collection_id: "collection-456",
              analysis_mode: "deep_research",
            },
          },
          metadata: {
            project_id: "project-123",
          },
        }),
      }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:8081/threads/thread-1/runs/stream");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const forwarded = JSON.parse(String(init.body)) as {
      input: { messages: Array<{ role: string; content: string }> };
      config: { configurable: Record<string, unknown> };
      metadata: Record<string, unknown>;
    };

    expect(forwarded.config.configurable).toMatchObject({
      project_id: "project-123",
      workspace_path: "/tmp/workspace",
      collection_id: "collection-456",
      analysis_mode: "deep_research",
    });
    expect(forwarded.metadata).toMatchObject({
      project_id: "project-123",
      analysis_mode: "deep_research",
    });
    expect(forwarded.input.messages[0]).toMatchObject({
      role: "system",
    });
    expect(forwarded.input.messages[1]).toMatchObject({
      role: "human",
      content: "Research this topic.",
    });

    fetchMock.mockRestore();
  });
});
