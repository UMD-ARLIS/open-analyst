import { listProjects } from "~/lib/db/queries/projects.server";
import { getSettings } from "~/lib/db/queries/settings.server";

export async function loader() {
  const [projects, settings] = await Promise.all([
    listProjects(),
    getSettings(),
  ]);
  return {
    projects,
    activeProjectId: settings.activeProjectId ?? null,
    workingDir: settings.workingDir || "",
    isConfigured: true,
  };
}
