import { getProjectProfile } from '~/lib/db/queries/workspace.server';
import { env } from '~/lib/env.server';
import { getMcpStatus, getMcpTools, listMcpServers } from '~/lib/mcp.server';
import { listRuntimeSkills } from '~/lib/runtime-skills.server';
import { listAvailableTools } from '~/lib/tools.server';
import { getSettings } from '~/lib/db/queries/settings.server';

const RUNTIME_URL = env.LANGGRAPH_RUNTIME_URL;

export interface WorkspaceConnectorSummary {
  id: string;
  name: string;
  alias?: string;
  enabled: boolean;
  connected: boolean;
  active: boolean;
  toolCount: number;
  error?: string;
}

export interface WorkspaceToolSummary {
  name: string;
  description: string;
  source: 'local' | 'mcp';
  serverId?: string;
  serverName?: string;
  active: boolean;
}

export interface WorkspaceContextData {
  activeConnectorIds: string[];
  pinnedSkillIds: string[];
  connectors: WorkspaceConnectorSummary[];
  tools: WorkspaceToolSummary[];
  skills: Array<{
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    pinned: boolean;
    tools: string[];
    sourceKind?: string;
  }>;
  profile: {
    brief: string;
    retrievalPolicy: Record<string, unknown>;
    memoryProfile: Record<string, unknown>;
    agentPolicies: Record<string, unknown>;
    defaultConnectorIds: string[];
    defaultSkillIds: string[];
  };
  diagnostics: {
    model: string;
    runtimeReachable: boolean;
    activeConnectorCount: number;
    pinnedSkillCount: number;
  };
  taskContext: Record<string, unknown>;
  memories: {
    active: Array<{
      id: string;
      title: string;
      summary: string;
      memoryType: string;
      status: string;
    }>;
    proposed: Array<{
      id: string;
      title: string;
      summary: string;
      memoryType: string;
      status: string;
    }>;
  };
}

function extractDefaultSkillIds(agentPolicies: Record<string, unknown> | null | undefined): string[] {
  const raw =
    agentPolicies && typeof agentPolicies === 'object'
      ? (agentPolicies.defaultSkillIds ??
          (agentPolicies.default_skill_ids as unknown) ??
          agentPolicies.pinnedSkillIds)
      : null;
  return Array.isArray(raw) ? raw.map((value) => String(value)).filter(Boolean) : [];
}

export async function buildWorkspaceContext(
  projectId: string,
  userId: string
): Promise<WorkspaceContextData> {
  const checkRuntimeHealth = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`${RUNTIME_URL}/health`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };

  const fetchStoreMemories = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${RUNTIME_URL}/store/items/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          namespace_prefix: ['open-analyst', 'projects', projectId, 'memories'],
          limit: 50,
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  };

  const [
    profile,
    settings,
    serverConfigs,
    statuses,
    discoveredTools,
    storeMemories,
    skills,
    runtimeReachable,
  ] =
    await Promise.all([
      getProjectProfile(projectId),
      getSettings(userId),
      Promise.resolve(listMcpServers(userId)),
      getMcpStatus(userId),
      getMcpTools(userId),
      fetchStoreMemories(),
      listRuntimeSkills({ userId, projectId }),
      checkRuntimeHealth(),
    ]);

  const allMemories = storeMemories.map((item: Record<string, unknown>) => {
    const value = (item.value ?? {}) as Record<string, unknown>;
    return {
      id: item.key as string,
      title: String(value.title || ''),
      summary: String(value.summary || ''),
      memoryType: String(value.memoryType || value.memory_type || 'note'),
      status: String(value.status || 'active'),
    };
  });
  const activeMemories = allMemories
    .filter((m: { status: string }) => m.status === 'active')
    .slice(0, 12);
  const proposedMemories = allMemories
    .filter((m: { status: string }) => m.status === 'proposed')
    .slice(0, 12);

  const enabledConnectorIds = serverConfigs
    .filter((server) => server.enabled)
    .map((server) => String(server.id));
  const activeConnectorIds = Array.isArray(profile?.defaultConnectorIds)
    ? profile.defaultConnectorIds.map((value) => String(value))
    : enabledConnectorIds;
  const pinnedSkillIds = extractDefaultSkillIds(profile?.agentPolicies);
  const activeConnectorSet = new Set(activeConnectorIds);
  const pinnedSkillSet = new Set(pinnedSkillIds);
  const statusById = new Map(statuses.map((status) => [status.id, status]));

  const connectors = serverConfigs.map((server) => {
    const status = statusById.get(server.id);
    return {
      id: server.id,
      name: server.name,
      alias: server.alias,
      enabled: server.enabled,
      connected: status?.connected ?? false,
      active: activeConnectorSet.has(server.id),
      toolCount: status?.toolCount ?? 0,
      error: status?.error,
    } satisfies WorkspaceConnectorSummary;
  });

  const tools: WorkspaceToolSummary[] = [
    ...listAvailableTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      source: 'local' as const,
      active: true,
    })),
    ...discoveredTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      source: 'mcp' as const,
      serverId: tool.serverId,
      serverName: tool.serverName,
      active: activeConnectorSet.has(tool.serverId),
    })),
  ];

  return {
    activeConnectorIds,
    pinnedSkillIds,
    connectors,
    tools,
    skills: skills
      .filter((skill) => skill.id !== 'repo-skill-skill-creator')
      .map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        enabled: skill.enabled,
        pinned: pinnedSkillSet.has(skill.id),
        tools: Array.isArray(skill.tools) ? skill.tools.map((tool) => String(tool)) : [],
        sourceKind: skill.source?.kind,
      })),
    profile: {
      brief: String(profile?.brief || ''),
      retrievalPolicy:
        profile?.retrievalPolicy && typeof profile.retrievalPolicy === 'object'
          ? (profile.retrievalPolicy as Record<string, unknown>)
          : {},
      memoryProfile:
        profile?.memoryProfile && typeof profile.memoryProfile === 'object'
          ? (profile.memoryProfile as Record<string, unknown>)
          : {},
      agentPolicies:
        profile?.agentPolicies && typeof profile.agentPolicies === 'object'
          ? (profile.agentPolicies as Record<string, unknown>)
          : {},
      defaultConnectorIds: Array.isArray(profile?.defaultConnectorIds)
        ? profile.defaultConnectorIds.map((value) => String(value))
        : [],
      defaultSkillIds: pinnedSkillIds,
    },
    diagnostics: {
      model: settings.model || '',
      runtimeReachable,
      activeConnectorCount: connectors.filter((connector) => connector.active).length,
      pinnedSkillCount: pinnedSkillIds.length,
    },
    taskContext: {},
    memories: {
      active: activeMemories.map(
        (memory: {
          id: string;
          title: string;
          summary: string;
          memoryType: string;
          status: string;
        }) => ({
          id: memory.id,
          title: memory.title,
          summary: memory.summary,
          memoryType: memory.memoryType,
          status: memory.status,
        })
      ),
      proposed: proposedMemories.map(
        (memory: {
          id: string;
          title: string;
          summary: string;
          memoryType: string;
          status: string;
        }) => ({
          id: memory.id,
          title: memory.title,
          summary: memory.summary,
          memoryType: memory.memoryType,
          status: memory.status,
        })
      ),
    },
  };
}
