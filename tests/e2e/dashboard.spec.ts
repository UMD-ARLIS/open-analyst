import { test, expect } from "@playwright/test";
import { createProject, deleteProject, deleteAllProjects, waitForHydration } from "./helpers";

test.describe("AssistantWorkspaceView", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    const project = await createProject(request, `E2E Dashboard ${Date.now()}`);
    projectId = project.id;
  });

  test.afterEach(async ({ request }) => {
    await deleteProject(request, projectId);
  });

  test('shows "Start a new analyst thread" heading', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    await expect(
      page.getByText("Start a new analyst thread")
    ).toBeVisible();
  });

  test("thread input textarea is present and editable", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    const textarea = page.getByPlaceholder("Ask the analyst to research, reason, critique, or draft...");
    await expect(textarea).toBeVisible();
    await textarea.fill("Test thread input");
    await expect(textarea).toHaveValue("Test thread input");
  });

  test("Deep Research toggle toggles tag-active class", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    const toggle = page.getByText("Deep Research");
    await expect(toggle).toBeVisible();

    // Initially not active
    await expect(toggle).not.toHaveClass(/tag-active/);

    // Click to activate
    await toggle.click();
    await expect(toggle).toHaveClass(/tag-active/);

    // Click again to deactivate
    await toggle.click();
    await expect(toggle).not.toHaveClass(/tag-active/);
  });

  test('"New Thread" and "Browse Sources" actions visible', async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);
    await expect(page.getByRole("button", { name: "New Thread" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Browse Sources" })).toBeVisible();
  });

  test("empty index route shows onboarding message when no projects", async ({
    page,
    request,
  }) => {
    // Delete all projects so there's a clean slate (other parallel tests may have created some)
    await deleteAllProjects(request);
    projectId = "";
    // Navigate to index
    await page.goto("/");
    await waitForHydration(page);
    await expect(page.getByText("Welcome to Open Analyst")).toBeVisible();
    await expect(
      page.getByText("Create your first project")
    ).toBeVisible();
  });
});
