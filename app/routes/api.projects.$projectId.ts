import { createProjectStore } from "~/lib/project-store.server";
import { saveConfig } from "~/lib/config.server";
import type { Route } from "./+types/api.projects.$projectId";

export async function loader({ params }: Route.LoaderArgs) {
  const store = createProjectStore();
  const project = store.getProject(params.projectId);
  if (!project) {
    return Response.json(
      { error: `Project not found: ${params.projectId}` },
      { status: 404 }
    );
  }
  return Response.json({ project });
}

export async function action({ request, params }: Route.ActionArgs) {
  const store = createProjectStore();
  const projectId = params.projectId;

  if (request.method === "PATCH") {
    const body = await request.json();
    try {
      const project = store.updateProject(projectId, body);
      return Response.json({ project });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 404 }
      );
    }
  }

  if (request.method === "DELETE") {
    try {
      const deleted = store.deleteProject(projectId);
      const activeProject = store.getActiveProject();
      const newActiveId = activeProject ? activeProject.id : "";
      saveConfig({ activeProjectId: newActiveId });
      return Response.json({
        ...deleted,
        activeProjectId: newActiveId,
      });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 404 }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
