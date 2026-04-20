import { requireUser } from '~/lib/auth/require-user.server';
import { listCredentials } from '~/lib/credentials.server';
import { getSettings } from '~/lib/db/queries/settings.server';
import { isLogsEnabled } from '~/lib/logs.server';
import { listMcpServers, getMcpPresets } from '~/lib/mcp.server';
import { listRuntimeSkills } from '~/lib/runtime-skills.server';

export async function loader({ request }: { request: Request }) {
  const { userId } = await requireUser(request);
  const settings = await getSettings(userId);
  return {
    credentials: listCredentials(userId),
    mcpServers: listMcpServers(userId),
    mcpPresets: getMcpPresets(),
    skills: await listRuntimeSkills({ userId }),
    logsEnabled: await isLogsEnabled(userId),
    currentModel: settings.model,
  };
}
