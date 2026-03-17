import { test, expect } from "@playwright/test";
import { createProject, deleteProject, deleteAllProjects, waitForHydration } from "./helpers";

test.describe("Sidebar", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    const project = await createProject(request, `E2E Sidebar ${Date.now()}`);
    projectId = project.id;
  });

  test.afterEach(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('shows "Runs" label when project active', async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    await expect(page.getByText("Runs", { exact: true })).toBeVisible();
  });

  test('shows "No runs yet." for empty project', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    await expect(page.getByText("No runs yet.")).toBeVisible();
  });

  test("collapse button hides task list, shows icon rail", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    // Sidebar should be expanded initially
    await expect(page.getByText("Runs", { exact: true })).toBeVisible();

    // Click the sidebar toggle in the nav
    await page.getByLabel("Collapse sidebar").click();

    // "Runs" text should be hidden when collapsed
    await expect(page.getByText("Runs", { exact: true })).not.toBeVisible();
  });

  test("expand button restores full sidebar", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);

    // Collapse first
    await page.getByLabel("Collapse sidebar").click();
    await expect(page.getByText("Runs", { exact: true })).not.toBeVisible();

    // Expand
    await page.getByLabel("Expand sidebar").click();
    await expect(page.getByText("Runs", { exact: true })).toBeVisible();
  });

  test('shows "Select a project to see runs" when no project selected', async ({
    page,
    request,
  }) => {
    // Delete all projects so there's no active project (other parallel tests may have created some)
    await deleteAllProjects(request);
    projectId = "";
    await page.goto("/");
    await waitForHydration(page);
    await expect(page.getByText("Select a project to see runs.")).toBeVisible();
  });

  test("user/settings footer visible", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    // The footer shows "User" text and settings icon
    await expect(page.getByText("User")).toBeVisible();
  });

  test("sidebar stays stable when no runs exist", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    await expect(page.getByText("No runs yet.")).toBeVisible();
  });
});
