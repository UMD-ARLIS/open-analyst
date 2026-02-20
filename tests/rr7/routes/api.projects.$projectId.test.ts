import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import { createProjectStore } from "../../../app/lib/project-store.server";
import {
  loader,
  action,
} from "../../../app/routes/api.projects.$projectId";
import {
  createMockLoaderArgs,
  createMockActionArgs,
  getJsonResponse,
} from "./helpers";

describe("api.projects.$projectId", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("GET returns project by ID", async () => {
    const store = createProjectStore(tempDir);
    const project = store.createProject({ name: "Found Project" });

    const args = createMockLoaderArgs(`/api/projects/${project.id}`, {
      projectId: project.id,
    });
    const response = await loader(args as never);
    const data = (await getJsonResponse(response)) as {
      project: { id: string; name: string };
    };
    expect(data.project.id).toBe(project.id);
    expect(data.project.name).toBe("Found Project");
  });

  it("GET returns 404 for missing project", async () => {
    const args = createMockLoaderArgs("/api/projects/nonexistent", {
      projectId: "nonexistent",
    });
    const response = await loader(args as never);
    expect(response.status).toBe(404);
  });

  it("PATCH updates project fields", async () => {
    const store = createProjectStore(tempDir);
    const project = store.createProject({ name: "Original" });

    const args = createMockActionArgs(
      "PATCH",
      `/api/projects/${project.id}`,
      { name: "Updated" },
      { projectId: project.id }
    );
    const response = await action(args as never);
    const data = (await getJsonResponse(response)) as {
      project: { name: string };
    };
    expect(data.project.name).toBe("Updated");
  });

  it("DELETE removes project", async () => {
    const store = createProjectStore(tempDir);
    const project = store.createProject({ name: "To Delete" });

    const args = createMockActionArgs(
      "DELETE",
      `/api/projects/${project.id}`,
      {},
      { projectId: project.id }
    );
    const response = await action(args as never);
    const data = (await getJsonResponse(response)) as { success: boolean };
    expect(data.success).toBe(true);
  });
});
