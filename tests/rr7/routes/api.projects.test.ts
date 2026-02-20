import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import { loader, action } from "../../../app/routes/api.projects";
import { createMockActionArgs, getJsonResponse } from "./helpers";

describe("api.projects", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("GET loader returns { activeProject, projects } shape", async () => {
    const response = await loader();
    const data = (await getJsonResponse(response)) as {
      activeProject: { id: string };
      projects: Array<{ id: string; name: string }>;
    };
    expect(data.activeProject).toBeDefined();
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects.length).toBeGreaterThan(0);
  });

  it("POST action creates project, returns 201", async () => {
    const args = createMockActionArgs("POST", "/api/projects", {
      name: "Test Project",
      description: "A test project",
    });
    const response = await action(args as never);
    expect(response.status).toBe(201);
    const data = (await getJsonResponse(response)) as {
      project: { id: string; name: string };
    };
    expect(data.project.name).toBe("Test Project");
  });
});
