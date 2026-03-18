import { getProject } from "~/lib/db/queries/projects.server";
import { getProjectProfile } from "~/lib/db/queries/workspace.server";
import { getMcpTools, listMcpServers } from "~/lib/mcp.server";
import { resolveProjectWorkspace } from "~/lib/project-storage.server";
import { listActiveSkills } from "~/lib/skills.server";
import { listAvailableTools } from "~/lib/tools.server";

export interface RuntimeContextOptions {
  request: Request;
  collectionId?: string | null;
  analysisMode?: string | null;
}

export async function buildRuntimeConfigurable(
  projectId: string,
  options: RuntimeContextOptions,
): Promise<Record<string, unknown>> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const [profile, serverConfigs, discoveredTools, activeSkills] = await Promise.all([
    getProjectProfile(projectId),
    Promise.resolve(listMcpServers()),
    getMcpTools(),
    Promise.resolve(listActiveSkills()),
  ]);

  const enabledConnectorIds = serverConfigs
    .filter((server) => server.enabled)
    .map((server) => String(server.id));
  const activeConnectorIds = Array.isArray(profile?.defaultConnectorIds)
    && profile.defaultConnectorIds.length
    ? profile.defaultConnectorIds.map((value) => String(value))
    : enabledConnectorIds;
  const activeConnectorSet = new Set(activeConnectorIds);
  const filteredSkills = activeSkills.filter((skill) => skill.id !== "repo-skill-skill-creator");
  const pinnedSkillIds = filteredSkills.map((skill) => String(skill.id));

  return {
    project_id: project.id,
    project_name: project.name,
    workspace_path: resolveProjectWorkspace(project),
    workspace_slug: project.workspaceSlug || "",
    brief: String(profile?.brief || ""),
    retrieval_policy:
      profile?.retrievalPolicy && typeof profile.retrievalPolicy === "object"
        ? profile.retrievalPolicy
        : {},
    memory_profile:
      profile?.memoryProfile && typeof profile.memoryProfile === "object"
        ? profile.memoryProfile
        : {},
    agent_policies:
      profile?.agentPolicies && typeof profile.agentPolicies === "object"
        ? profile.agentPolicies
        : {},
    active_connector_ids: activeConnectorIds,
    connector_ids: enabledConnectorIds,
    available_tools: [
      ...listAvailableTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        source: "local",
        active: true,
      })),
      ...discoveredTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        source: "mcp",
        server_id: tool.serverId,
        server_name: tool.serverName,
        active: activeConnectorSet.has(tool.serverId),
      })),
    ],
    available_skills: filteredSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description || "",
      enabled: skill.enabled,
      tools: Array.isArray(skill.tools) ? skill.tools.map((tool) => String(tool)) : [],
      source_kind: skill.source?.kind || null,
    })),
    pinned_skill_ids: pinnedSkillIds,
    matched_skill_ids: [],
    api_base_url: new URL(options.request.url).origin,
    collection_id: options.collectionId || null,
    analysis_mode: String(options.analysisMode || "chat").trim() || "chat",
  };
}
