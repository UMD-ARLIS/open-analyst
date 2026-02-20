import { createProjectStore } from "~/lib/project-store.server";
import { loadConfig } from "~/lib/config.server";

export async function loader() {
  const store = createProjectStore();
  const projects = store.listProjects();
  const activeProject = store.getActiveProject();
  const config = loadConfig();
  return {
    projects,
    activeProjectId: activeProject?.id ?? null,
    workingDir: config.workingDir || "",
    isConfigured: Boolean(config.apiKey?.trim()),
  };
}
