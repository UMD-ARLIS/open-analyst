import { expect, test } from "@playwright/test";
import {
  createCollection,
  createDocument,
  createProject,
  deleteProject,
  scopedName,
  waitForHydration,
} from "./helpers";

test.describe("Chat thread flow", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    const project = await createProject(request, scopedName("Chat Project"));
    projectId = project.id;

    const collection = await createCollection(
      request,
      projectId,
      scopedName("Chat Knowledge")
    );
    await createDocument(request, projectId, {
      collectionId: collection.id,
      title: scopedName("Chat Note"),
      content: "Knowledge panel fixture for the live chat test.",
      sourceType: "manual",
    });
  });

  test.afterEach(async ({ request }) => {
    if (projectId) {
      await deleteProject(request, projectId);
    }
  });

  test("creates a live thread and keeps the user message in the thread view", async ({
    page,
  }) => {
    const prompt = "Reply with a short confirmation that the live chat test reached the model.";

    await page.goto(`/projects/${projectId}`);
    await waitForHydration(page);

    await page
      .getByPlaceholder("Ask the analyst to research, reason, critique, or draft...")
      .fill(prompt);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/threads/[^/]+$`));

    await expect(
      page.locator("p").filter({ hasText: prompt }).first()
    ).toBeVisible();

    await page.reload();
    await waitForHydration(page);
    await expect(
      page.locator("p").filter({ hasText: prompt }).first()
    ).toBeVisible();
  });
});
