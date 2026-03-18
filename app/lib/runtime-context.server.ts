import { getProject } from "~/lib/db/queries/projects.server";
import { getProjectProfile } from "~/lib/db/queries/workspace.server";
import { getMcpTools, listMcpServers } from "~/lib/mcp.server";
import { resolveProjectWorkspace } from "~/lib/project-storage.server";
import { listActiveSkills } from "~/lib/skills.server";
import { listAvailableTools } from "~/lib/tools.server";

export interface RuntimeProjectContextPayload {
  project_id: string;
  project_name: string;
  workspace_path: string;
  workspace_slug: string;
  current_date: string;
  current_datetime_utc: string;
  brief: string;
  retrieval_policy: Record<string, unknown>;
  memory_profile: Record<string, unknown>;
  agent_policies: Record<string, unknown>;
  active_connector_ids: string[];
  connector_ids: string[];
  available_tools: Array<Record<string, unknown>>;
  available_skills: Array<Record<string, unknown>>;
  pinned_skill_ids: string[];
  matched_skill_ids: string[];
  api_base_url: string;
  collection_id: string | null;
  analysis_mode: string;
}

export interface RuntimeContextOptions {
  request: Request;
  collectionId?: string | null;
  analysisMode?: string | null;
}

export async function buildRuntimeContext(
  projectId: string,
  options: RuntimeContextOptions,
): Promise<RuntimeProjectContextPayload> {
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
  const currentDateTime = new Date();

  return {
    project_id: project.id,
    project_name: project.name,
    workspace_path: resolveProjectWorkspace(project),
    workspace_slug: project.workspaceSlug || "",
    current_date: currentDateTime.toISOString().slice(0, 10),
    current_datetime_utc: currentDateTime.toISOString(),
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
