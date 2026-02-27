import { listProjects } from "~/lib/db/queries/projects.server";
import {
  getSettings,
  upsertSettings,
} from "~/lib/db/queries/settings.server";
import { resolveModel } from "~/lib/litellm.server";

export async function loader() {
  const [projects, settings] = await Promise.all([
    listProjects(),
    getSettings(),
  ]);

  // Validate the persisted model against LiteLLM.
  // If empty or no longer available, default to first available and persist.
  const resolvedModel = await resolveModel(settings.model);
  if (resolvedModel !== settings.model) {
    await upsertSettings({ model: resolvedModel });
  }

  return {
    projects,
    activeProjectId: settings.activeProjectId ?? null,
    workingDir: settings.workingDir || "",
    model: resolvedModel,
    isConfigured: true,
  };
}
