import fs from 'fs';
import path from 'path';
import os from 'os';

export function getConfigDir(): string {
  const envDir = process.env.OPEN_ANALYST_DATA_DIR;
  if (envDir) return envDir;
  return path.join(os.homedir(), '.config', 'open-analyst');
}

function sanitizeUserId(userId: string): string {
  return String(userId || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getUserConfigDir(userId: string, baseDir?: string): string {
  const sanitized = sanitizeUserId(userId) || 'anonymous';
  return path.join(baseDir ?? getConfigDir(), 'users', sanitized);
}

export function ensureConfigDir(configDir?: string): string {
  const dir = configDir ?? getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function ensureUserConfigDir(userId: string, baseDir?: string): string {
  const dir = getUserConfigDir(userId, baseDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function loadJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function saveJsonFile(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export function loadJsonArray<T>(filePath: string): T[] {
  const result = loadJsonFile<unknown>(filePath, []);
  return Array.isArray(result) ? result : [];
}

export function saveJsonArray<T>(filePath: string, value: T[]): void {
  saveJsonFile(filePath, Array.isArray(value) ? value : []);
}

export function nowIso(): string {
  return new Date().toISOString();
}
