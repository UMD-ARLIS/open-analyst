import type { APIRequestContext, Page } from "@playwright/test";

export const BASE_URL = "http://localhost:5173";

/** Create a project via the API and return its id and name. */
export async function createProject(
  request: APIRequestContext,
  name: string
): Promise<{ id: string; name: string }> {
  const res = await request.post(`${BASE_URL}/api/projects`, {
    data: { name },
  });
  if (!res.ok()) throw new Error(`Failed to create project: ${res.status()}`);
  const body = await res.json();
  return { id: body.project.id, name: body.project.name };
}

/** Delete a project via the API. */
export async function deleteProject(
  request: APIRequestContext,
  id: string
): Promise<void> {
  await request.delete(`${BASE_URL}/api/projects/${id}`);
}

/** Delete all projects via the API. */
export async function deleteAllProjects(
  request: APIRequestContext
): Promise<void> {
  const res = await request.get(`${BASE_URL}/api/projects`);
  const { projects } = await res.json();
  for (const p of projects) {
    await request.delete(`${BASE_URL}/api/projects/${p.id}`);
  }
}

/** Wait for the app layout to finish hydrating (Zustand store synced from loader). */
export async function waitForHydration(page: Page) {
  await page.locator("[data-hydrated]").waitFor({ state: "attached" });
}

/** Delete a task via the API. */
export async function deleteTask(
  request: APIRequestContext,
  projectId: string,
  taskId: string
): Promise<void> {
  await request.delete(
    `${BASE_URL}/api/projects/${projectId}/tasks/${taskId}`
  );
}
