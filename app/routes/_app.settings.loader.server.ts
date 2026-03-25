import { requireUser } from '~/lib/auth/require-user.server';
import { listCredentials } from '~/lib/credentials.server';
import { getSettings } from '~/lib/db/queries/settings.server';
import { isLogsEnabled } from '~/lib/logs.server';
import { listMcpServers, getMcpPresets } from '~/lib/mcp.server';
import { listSkills } from '~/lib/skills.server';

export async function loader({ request }: { request: Request }) {
  const { userId } = await requireUser(request);
  const settings = await getSettings(userId);
  return {
    credentials: listCredentials(),
    mcpServers: listMcpServers(),
    mcpPresets: getMcpPresets(),
    skills: listSkills(),
    logsEnabled: await isLogsEnabled(userId),
    currentModel: settings.model,
  };
}
