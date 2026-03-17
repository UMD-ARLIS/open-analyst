import { getProject } from "~/lib/db/queries/projects.server";
import { getProjectProfile } from "~/lib/db/queries/workspace.server";
import type { RuntimeProjectContext } from "~/lib/runtime-client.server";

export async function buildRuntimeProjectContext(projectId: string): Promise<RuntimeProjectContext> {
  const [project, profile] = await Promise.all([
    getProject(projectId),
    getProjectProfile(projectId),
  ]);

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return {
    project_id: project.id,
    project_name: project.name,
    brief: profile?.brief || project.description || "",
    retrieval_policy:
      profile?.retrievalPolicy && typeof profile.retrievalPolicy === "object"
        ? (profile.retrievalPolicy as Record<string, unknown>)
        : {},
    memory_profile:
      profile?.memoryProfile && typeof profile.memoryProfile === "object"
        ? (profile.memoryProfile as Record<string, unknown>)
        : {},
    templates: Array.isArray(profile?.templates)
      ? (profile?.templates as Array<Record<string, unknown>>)
      : [],
    agent_policies:
      profile?.agentPolicies && typeof profile.agentPolicies === "object"
        ? (profile.agentPolicies as Record<string, unknown>)
        : {},
    connector_ids: Array.isArray(profile?.defaultConnectorIds)
      ? profile.defaultConnectorIds.map((value) => String(value))
      : [],
  };
}
