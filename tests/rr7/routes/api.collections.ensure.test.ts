import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import { createProjectStore } from "~/lib/project-store.server";
import { action } from "~/routes/api.projects.$projectId.collections.ensure";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/projects/test-proj/collections/ensure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/projects/:projectId/collections/ensure", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
    // Create a project so the store can find it
    const store = createProjectStore();
    store.createProject({ name: "Test Project" });
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("creates new collection when name doesn't exist", async () => {
    const store = createProjectStore();
    const projects = store.listProjects();
    const projectId = projects[0].id;

    const response = await action({
      request: makeRequest({ name: "Research Papers", description: "Papers for review" }),
      params: { projectId },
      context: {},
    });
    const data = await response.json();

    expect(data.collection).toBeDefined();
    expect(data.collection.name).toBe("Research Papers");
    expect(data.collection.description).toBe("Papers for review");
    expect(data.collection.id).toBeTruthy();
  });

  it("returns existing collection when name matches (case-insensitive)", async () => {
    const store = createProjectStore();
    const projects = store.listProjects();
    const projectId = projects[0].id;

    // Create collection first
    store.createCollection(projectId, {
      name: "Research Papers",
      description: "Original",
    });

    const response = await action({
      request: makeRequest({ name: "research papers" }),
      params: { projectId },
      context: {},
    });
    const data = await response.json();

    expect(data.collection.name).toBe("Research Papers");
    expect(data.collection.description).toBe("Original");

    // Verify only one collection exists
    const collections = store.listCollections(projectId);
    expect(collections.filter((c) => c.name.toLowerCase() === "research papers")).toHaveLength(1);
  });

  it("returns 400 when name is missing", async () => {
    const store = createProjectStore();
    const projects = store.listProjects();
    const projectId = projects[0].id;

    const response = await action({
      request: makeRequest({}),
      params: { projectId },
      context: {},
    });
    expect(response.status).toBe(400);
  });

  it("returns 405 for non-POST methods", async () => {
    const store = createProjectStore();
    const projects = store.listProjects();
    const projectId = projects[0].id;

    const response = await action({
      request: new Request("http://localhost/api/projects/test/collections/ensure", {
        method: "GET",
      }),
      params: { projectId },
      context: {},
    });
    expect(response.status).toBe(405);
  });
});
