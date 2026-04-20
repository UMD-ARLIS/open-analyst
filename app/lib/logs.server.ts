import fs from 'fs';
import path from 'path';
import { getUserConfigDir } from './helpers.server';
import { getSettings, upsertSettings } from './db/queries/settings.server';

const LOGS_DIRNAME = 'logs';
const HEADLESS_LOG_FILENAME = 'headless.log';

function getLogsDir(userId: string, configDir?: string): string {
  return path.join(configDir ?? getUserConfigDir(userId), LOGS_DIRNAME);
}

function ensureLogsDir(userId: string, configDir?: string): string {
  const dir = getLogsDir(userId, configDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function listLogs(userId: string, configDir?: string): {
  files: Array<{
    name: string;
    path: string;
    size: number;
    mtime: string;
  }>;
  directory: string;
} {
  const dir = ensureLogsDir(userId, configDir);
  const files = fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((item) => fs.statSync(item).isFile())
    .map((item) => {
      const stat = fs.statSync(item);
      return {
        name: path.basename(item),
        path: item,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));
  return { files, directory: dir };
}

export async function isLogsEnabled(userId: string): Promise<boolean> {
  const settings = await getSettings(userId);
  return settings.devLogsEnabled !== false;
}

export async function setLogsEnabled(
  enabled: boolean,
  userId: string
): Promise<{ success: boolean; enabled: boolean }> {
  await upsertSettings({ devLogsEnabled: enabled }, userId);
  return { success: true, enabled };
}

export function exportLogs(userId: string, configDir?: string): { success: boolean; path: string } {
  const dir = ensureLogsDir(userId, configDir);
  const exportPath = path.join(dir, `open-analyst-logs-${Date.now()}.txt`);
  const files = fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((item) => fs.statSync(item).isFile() && item !== exportPath);
  const bodyText = files
    .map((filePath) => {
      const name = path.basename(filePath);
      const text = fs.readFileSync(filePath, 'utf8');
      return `\n===== ${name} =====\n${text}`;
    })
    .join('\n');
  fs.writeFileSync(exportPath, bodyText || 'No logs available.', 'utf8');
  return { success: true, path: exportPath };
}

export function clearLogs(
  userId: string,
  configDir?: string
): { success: boolean; deletedCount: number } {
  const dir = ensureLogsDir(userId, configDir);
  const files = fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((item) => fs.statSync(item).isFile());
  let deletedCount = 0;
  for (const filePath of files) {
    fs.unlinkSync(filePath);
    deletedCount += 1;
  }
  return { success: true, deletedCount };
}

export async function appendLog(
  level: string,
  message: string,
  metadata: Record<string, unknown> = {},
  userId?: string
): Promise<void> {
  try {
    const resolvedUserId = userId ?? 'dev-user';
    const settings = await getSettings(resolvedUserId);
    if (settings.devLogsEnabled === false) return;
    const dir = ensureLogsDir(resolvedUserId);
    const logPath = path.join(dir, HEADLESS_LOG_FILENAME);
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message: String(message || ''),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
    fs.appendFileSync(logPath, `${line}\n`, 'utf8');
  } catch {
    // Best effort logging
  }
}
