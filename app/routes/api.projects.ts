import { createProjectStore } from "~/lib/project-store.server";
import { loadConfig, saveConfig } from "~/lib/config.server";
import type { Route } from "./+types/api.projects";

export async function loader() {
  const store = createProjectStore();
  return Response.json({
    activeProject: store.getActiveProject(),
    projects: store.listProjects(),
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const store = createProjectStore();
  const project = store.createProject({
    name: body.name,
    description: body.description,
    datastores: body.datastores,
  });
  const cfg = loadConfig();
  cfg.activeProjectId = project.id;
  saveConfig(cfg);
  return Response.json(
    { project, activeProjectId: project.id },
    { status: 201 }
  );
}
