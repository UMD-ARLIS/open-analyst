import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  ensureConfigDir,
  getConfigDir,
  loadJsonArray,
  saveJsonArray,
} from "./helpers.server";
import type { SkillConfig } from "./types";

const SKILLS_FILENAME = "skills.json";

function getSkillsPath(configDir?: string): string {
  return path.join(configDir ?? getConfigDir(), SKILLS_FILENAME);
}

function defaultSkills(): SkillConfig[] {
  const ts = Date.now();
  return [
    {
      id: "builtin-web-research",
      name: "Web Research",
      description: "Web search/fetch/arXiv/HF capture workflow",
      type: "builtin",
      enabled: true,
      config: {
        tools: [
          "deep_research",
          "web_search",
          "web_fetch",
          "arxiv_search",
          "hf_daily_papers",
          "hf_paper",
        ],
      },
      createdAt: ts,
    },
    {
      id: "builtin-code-ops",
      name: "Code Operations",
      description: "Read/write/edit/grep/glob/execute workflow",
      type: "builtin",
      enabled: true,
      config: {
        tools: [
          "list_directory",
          "read_file",
          "write_file",
          "edit_file",
          "glob",
          "grep",
          "execute_command",
        ],
      },
      createdAt: ts,
    },
  ];
}

export function listSkills(configDir?: string): SkillConfig[] {
  ensureConfigDir(configDir);
  const existing = loadJsonArray<SkillConfig>(getSkillsPath(configDir));
  if (existing.length) return existing;
  const defaults = defaultSkills();
  saveJsonArray(getSkillsPath(configDir), defaults);
  return defaults;
}

export function validateSkillPath(
  folderPath: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!folderPath) {
    errors.push("folderPath is required");
  } else {
    if (!fs.existsSync(folderPath)) errors.push("Folder does not exist");
    if (fs.existsSync(folderPath) && !fs.statSync(folderPath).isDirectory())
      errors.push("Path is not a directory");
    if (
      fs.existsSync(folderPath) &&
      !fs.existsSync(path.join(folderPath, "SKILL.md"))
    )
      errors.push("Missing SKILL.md");
  }
  return { valid: errors.length === 0, errors };
}

export function installSkill(
  folderPath: string,
  configDir?: string
): SkillConfig {
  const skillPath = path.resolve(folderPath);
  const skillName = path.basename(skillPath);
  const skill: SkillConfig = {
    id: `skill-${randomUUID()}`,
    name: skillName,
    description: `Installed from ${skillPath}`,
    type: "custom",
    enabled: true,
    config: { folderPath: skillPath },
    createdAt: Date.now(),
  };
  const skills = listSkills(configDir);
  skills.unshift(skill);
  saveJsonArray(getSkillsPath(configDir), skills);
  return skill;
}

export function deleteSkill(
  id: string,
  configDir?: string
): { success: boolean } {
  const skills = listSkills(configDir);
  saveJsonArray(
    getSkillsPath(configDir),
    skills.filter((item) => item.id !== id)
  );
  return { success: true };
}

export function setSkillEnabled(
  id: string,
  enabled: boolean,
  configDir?: string
): SkillConfig | null {
  const skills = listSkills(configDir);
  const idx = skills.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  skills[idx] = { ...skills[idx], enabled };
  saveJsonArray(getSkillsPath(configDir), skills);
  return skills[idx];
}
