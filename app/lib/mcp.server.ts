import path from "path";
import {
  ensureConfigDir,
  getConfigDir,
  loadJsonArray,
  saveJsonArray,
} from "./helpers.server";
import { listAvailableTools } from "./tools.server";
import type { McpServerConfig, McpPreset } from "./types";

const MCP_SERVERS_FILENAME = "mcp-servers.json";

function getServersPath(configDir?: string): string {
  return path.join(configDir ?? getConfigDir(), MCP_SERVERS_FILENAME);
}

function defaultMcpServers(): McpServerConfig[] {
  return [
    {
      id: "mcp-example-filesystem",
      name: "Filesystem (Example)",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      env: {},
      enabled: false,
    },
  ];
}

export function getMcpPresets(): Record<string, McpPreset> {
  return {
    filesystem: {
      name: "Filesystem",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      requiresEnv: [],
      env: {},
    },
    fetch: {
      name: "Fetch",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
      requiresEnv: [],
      env: {},
    },
    github: {
      name: "GitHub",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      requiresEnv: ["GITHUB_TOKEN"],
      env: {},
    },
  };
}

export function listMcpServers(configDir?: string): McpServerConfig[] {
  ensureConfigDir(configDir);
  const existing = loadJsonArray<McpServerConfig>(getServersPath(configDir));
  if (existing.length) return existing;
  const defaults = defaultMcpServers();
  saveJsonArray(getServersPath(configDir), defaults);
  return defaults;
}

export function saveMcpServer(
  input: Partial<McpServerConfig> & { id?: string },
  configDir?: string
): McpServerConfig {
  const servers = listMcpServers(configDir);
  const serverConfig: McpServerConfig = {
    id: String(input.id || "").trim() || `mcp-${Date.now()}`,
    name: String(input.name || "").trim() || "MCP Server",
    type: input.type === "sse" ? "sse" : "stdio",
    command: typeof input.command === "string" ? input.command : undefined,
    args: Array.isArray(input.args)
      ? input.args.map((item) => String(item))
      : undefined,
    env:
      input.env && typeof input.env === "object"
        ? (input.env as Record<string, string>)
        : undefined,
    url: typeof input.url === "string" ? input.url : undefined,
    headers:
      input.headers && typeof input.headers === "object"
        ? (input.headers as Record<string, string>)
        : undefined,
    enabled: input.enabled !== false,
  };
  const idx = servers.findIndex((item) => item.id === serverConfig.id);
  if (idx === -1) {
    servers.unshift(serverConfig);
  } else {
    servers[idx] = serverConfig;
  }
  saveJsonArray(getServersPath(configDir), servers);
  return serverConfig;
}

export function deleteMcpServer(
  id: string,
  configDir?: string
): { success: boolean } {
  const servers = listMcpServers(configDir);
  const next = servers.filter((item) => item.id !== id);
  saveJsonArray(getServersPath(configDir), next);
  return { success: true };
}

export function getMcpStatus(
  configDir?: string
): Array<{
  id: string;
  name: string;
  connected: boolean;
  toolCount: number;
}> {
  const servers = listMcpServers(configDir);
  return servers.map((server) => ({
    id: server.id,
    name: server.name,
    connected: Boolean(server.enabled),
    toolCount: server.enabled ? listAvailableTools().length : 0,
  }));
}

export function getMcpTools(
  configDir?: string
): Array<{ serverId: string; name: string; description: string }> {
  const servers = listMcpServers(configDir).filter((s) => s.enabled);
  return servers.flatMap((server) =>
    listAvailableTools().map((tool) => ({
      serverId: server.id,
      name: tool.name,
      description: tool.description,
    }))
  );
}
