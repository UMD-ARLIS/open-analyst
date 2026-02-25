import {
  createProject,
  listProjects,
} from "~/lib/db/queries/projects.server";
import { upsertSettings } from "~/lib/db/queries/settings.server";
import type { Route } from "./+types/api.projects";

export async function loader() {
  const projects = await listProjects();
  return Response.json({ projects });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const project = await createProject({
    name: body.name,
    description: body.description,
    datastores: body.datastores,
  });
  await upsertSettings({ activeProjectId: project.id });
  return Response.json(
    { project, activeProjectId: project.id },
    { status: 201 }
  );
}
