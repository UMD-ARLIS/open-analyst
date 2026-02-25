import { listCredentials } from "~/lib/credentials.server";
import { listMcpServers, getMcpPresets } from "~/lib/mcp.server";
import { listSkills } from "~/lib/skills.server";
import { isLogsEnabled } from "~/lib/logs.server";

export async function loader() {
  return {
    credentials: listCredentials(),
    mcpServers: listMcpServers(),
    mcpPresets: getMcpPresets(),
    skills: listSkills(),
    logsEnabled: await isLogsEnabled(),
  };
}
