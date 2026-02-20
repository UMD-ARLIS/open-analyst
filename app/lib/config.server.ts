import fs from "fs";
import path from "path";
import {
  ensureConfigDir,
  getConfigDir,
  loadJsonFile,
  saveJsonFile,
} from "./helpers.server";
import type { HeadlessConfig } from "./types";

const CONFIG_FILENAME = "headless-config.json";

const DEFAULT_CONFIG: HeadlessConfig = {
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  bedrockRegion: "us-east-1",
  model: "gpt-4o",
  openaiMode: "chat",
  workingDir: process.cwd(),
  workingDirType: "local",
  s3Uri: "",
  activeProjectId: "",
};

function inferBedrockRegion(baseUrl: string): string {
  const value = String(baseUrl || "").toLowerCase();
  const runtimeMatch = value.match(
    /bedrock-runtime\.([a-z0-9-]+)\.amazonaws\.com/
  );
  if (runtimeMatch?.[1]) return runtimeMatch[1];
  const mantleMatch = value.match(
    /bedrock-mantle\.([a-z0-9-]+)\.api\.aws/
  );
  return mantleMatch?.[1] || "us-east-1";
}

export function normalizeConfig(
  input: Partial<HeadlessConfig>
): HeadlessConfig {
  const config = { ...DEFAULT_CONFIG, ...input };
  if (config.provider === "bedrock") {
    const region =
      String(config.bedrockRegion || "").trim().toLowerCase() ||
      inferBedrockRegion(config.baseUrl);
    config.bedrockRegion = region || "us-east-1";
    if (!String(config.baseUrl || "").trim()) {
      config.baseUrl = `https://bedrock-mantle.${config.bedrockRegion}.api.aws/v1`;
    } else if (!String(config.baseUrl).trim().endsWith("/v1")) {
      config.baseUrl = `${String(config.baseUrl).replace(/\/+$/, "")}/v1`;
    }
    if (!config.openaiMode) config.openaiMode = "responses";
  }
  return config;
}

export function getConfigPath(configDir?: string): string {
  return path.join(configDir ?? getConfigDir(), CONFIG_FILENAME);
}

export function loadConfig(configDir?: string): HeadlessConfig {
  const dir = ensureConfigDir(configDir);
  const configPath = path.join(dir, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    const initial = normalizeConfig({ ...DEFAULT_CONFIG });
    fs.writeFileSync(configPath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  const parsed = loadJsonFile<Partial<HeadlessConfig>>(configPath, {});
  return normalizeConfig({ ...DEFAULT_CONFIG, ...parsed });
}

export function saveConfig(
  config: Partial<HeadlessConfig>,
  configDir?: string
): void {
  const dir = ensureConfigDir(configDir);
  const normalized = normalizeConfig(config);
  saveJsonFile(path.join(dir, CONFIG_FILENAME), normalized);
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  return "***";
}
