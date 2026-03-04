import { describe, expect, it, beforeAll } from "vitest";
import { createProject } from "~/lib/db/queries/projects.server";
import {
  loader,
  action,
} from "../../../app/routes/api.projects.$projectId";
import {
  createMockLoaderArgs,
  createMockActionArgs,
  getJsonResponse,
} from "./helpers";

let testProjectId: string;

beforeAll(async () => {
  const project = await createProject({ name: "Found Project" });
  testProjectId = project.id;
});

describe("api.projects.$projectId", () => {
  it("GET returns project by ID", async () => {
    const args = createMockLoaderArgs(`/api/projects/${testProjectId}`, {
      projectId: testProjectId,
    });
    const response = await loader(args as never);
    const data = (await getJsonResponse(response)) as {
      project: { id: string; name: string };
    };
    expect(data.project.id).toBe(testProjectId);
    expect(data.project.name).toBe("Found Project");
  });

  it("GET returns 404 for missing project", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const args = createMockLoaderArgs(`/api/projects/${fakeId}`, {
      projectId: fakeId,
    });
    const response = await loader(args as never);
    expect(response.status).toBe(404);
  });

  it("PATCH updates project fields", async () => {
    const project = await createProject({ name: "Original" });

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
    const project = await createProject({ name: "To Delete" });

    const args = createMockActionArgs(
      "DELETE",
      `/api/projects/${project.id}`,
      {},
      { projectId: project.id }
    );
    const response = await action(args as never);
    const data = (await getJsonResponse(response)) as Record<string, unknown>;
    expect(data.success).toBe(true);
  });
});
