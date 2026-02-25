import { createProjectStore } from "~/lib/project-store.server";
import { saveConfig } from "~/lib/config.server";
import type { Route } from "./+types/api.projects.active";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const projectId = String(body.projectId || "").trim();
  if (!projectId) {
    return Response.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }
  const store = createProjectStore();
  store.setActiveProject(projectId);
  saveConfig({ activeProjectId: projectId });
  return Response.json({ success: true, activeProjectId: projectId });
}
