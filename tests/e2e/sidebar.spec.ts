import { test, expect } from "@playwright/test";
import { createProject, deleteProject } from "./helpers";

test.describe("Sidebar", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    const project = await createProject(request, `E2E Sidebar ${Date.now()}`);
    projectId = project.id;
  });

  test.afterEach(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('shows "Tasks" label and "New" button when project active', async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText("Tasks", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New task" })).toBeVisible();
  });

  test('shows "No tasks yet." for empty project', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText("No tasks yet.")).toBeVisible();
  });

  test("collapse button hides task list, shows icon rail", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}`);
    // Sidebar should be expanded initially
    await expect(page.getByText("Tasks", { exact: true })).toBeVisible();

    // Click the sidebar toggle in the nav
    await page.getByLabel("Collapse sidebar").click();

    // "Tasks" text should be hidden when collapsed
    await expect(page.getByText("Tasks", { exact: true })).not.toBeVisible();
  });

  test("expand button restores full sidebar", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    // Collapse first
    await page.getByLabel("Collapse sidebar").click();
    await expect(page.getByText("Tasks", { exact: true })).not.toBeVisible();

    // Expand
    await page.getByLabel("Expand sidebar").click();
    await expect(page.getByText("Tasks", { exact: true })).toBeVisible();
  });

  test('shows "Select a project to see tasks" when no project selected', async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText("Select a project to see tasks.")
    ).toBeVisible();
  });

  test("user/settings footer visible", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    // The footer shows "User" text and settings icon
    await expect(page.getByText("User")).toBeVisible();
  });
});
