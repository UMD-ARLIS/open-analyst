import { describe, expect, it, vi } from "vitest";
import * as sourceIngest from "~/lib/source-ingest.server";
import { action } from "~/routes/api.projects.$projectId.source-ingest";

describe("POST /api/projects/:projectId/source-ingest", () => {
  it("prioritizes explicit approved items over the legacy literature re-search path", async () => {
    const stageSourceIngestBatch = vi
      .spyOn(sourceIngest, "stageSourceIngestBatch")
      .mockResolvedValue({
        id: "batch-123",
        projectId: "project-123",
        collectionId: null,
        collectionName: "Research Inbox",
        origin: "literature",
        status: "staged",
        query: "supply chain risk",
        summary: "Approved items",
        requestedCount: 1,
        importedCount: 0,
        metadata: {},
        approvedAt: null,
        completedAt: null,
        rejectedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      });
    const restageSpy = vi.spyOn(sourceIngest, "stageLiteratureCollectionBatch");

    const response = await action({
      params: { projectId: "project-123" },
      request: new Request("http://localhost/api/projects/project-123/source-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: "literature",
          query: "supply chain risk",
          items: [
            {
              externalId: "paper:abc",
              title: "Approved Paper",
              sourceUrl: "https://example.com/paper",
              normalizedMetadata: {
                canonicalId: "paper:abc",
              },
            },
          ],
        }),
      }),
    });

    expect(response.status).toBe(201);
    expect(stageSourceIngestBatch).toHaveBeenCalledTimes(1);
    expect(restageSpy).not.toHaveBeenCalled();
    expect(stageSourceIngestBatch.mock.calls[0]?.[1]).toMatchObject({
      origin: "literature",
      query: "supply chain risk",
      items: [
        expect.objectContaining({
          externalId: "paper:abc",
          title: "Approved Paper",
        }),
      ],
    });
  });
});
