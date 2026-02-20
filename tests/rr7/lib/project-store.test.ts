import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import { createProjectStore } from "../../../app/lib/project-store.server";

describe("project-store.server", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("creates default project and supports CRUD", () => {
    const store = createProjectStore(tempDir);

    const initial = store.listProjects();
    expect(initial.length).toBe(1);
    expect(initial[0].name).toBe("Default Project");

    const project = store.createProject({ name: "Intel Ops", description: "Primary workspace" });
    expect(project.name).toBe("Intel Ops");

    const loaded = store.getProject(project.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Intel Ops");

    const updated = store.updateProject(project.id, { description: "Updated" });
    expect(updated.description).toBe("Updated");

    const deleted = store.deleteProject(project.id);
    expect(deleted.success).toBe(true);
    expect(store.getProject(project.id)).toBeNull();
  });

  it("stores collections and lists them", () => {
    const store = createProjectStore(tempDir);
    const project = store.createProject({ name: "Coll Project" });

    const collection = store.createCollection(project.id, { name: "Web Sources" });
    expect(collection.id).toBeDefined();
    expect(collection.name).toBe("Web Sources");

    const collections = store.listCollections(project.id);
    expect(collections.length).toBe(1);
  });

  it("stores documents, lists them, and queries with RAG", () => {
    const store = createProjectStore(tempDir);
    const project = store.createProject({ name: "RAG Project" });
    const collection = store.createCollection(project.id, { name: "Web Sources" });

    store.createDocument(project.id, {
      collectionId: collection.id,
      title: "Kubernetes Security Baselines",
      sourceType: "url",
      sourceUri: "https://example.com/k8s",
      content: "Kubernetes pod security standards and network policies are critical controls.",
    });

    store.createDocument(project.id, {
      collectionId: collection.id,
      title: "General Notes",
      sourceType: "manual",
      sourceUri: "notes://1",
      content: "Random planning text unrelated to container security.",
    });

    const docs = store.listDocuments(project.id);
    expect(docs.length).toBe(2);

    const result = store.queryDocuments(project.id, "kubernetes security policies", { limit: 2 });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].title).toContain("Kubernetes");
    expect(result.results[0].score).toBeGreaterThan(0);
    expect(result.results[0].snippet.length).toBeGreaterThan(0);
  });

  it("tracks run lifecycle and events", () => {
    const store = createProjectStore(tempDir);
    const project = store.createProject({ name: "Run Project" });

    const run = store.createRun(project.id, {
      type: "chat",
      status: "running",
      prompt: "Summarize sources",
    });

    const event = store.appendRunEvent(project.id, run.id, "tool_call_started", {
      toolName: "web_search",
    });
    expect(event.type).toBe("tool_call_started");

    const completed = store.updateRun(project.id, run.id, {
      status: "completed",
      output: "Done",
    });
    expect(completed.status).toBe("completed");

    const loaded = store.getRun(project.id, run.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.events.length).toBe(1);
    expect(loaded!.output).toBe("Done");

    const runs = store.listRuns(project.id);
    expect(runs.length).toBe(1);
  });
});
