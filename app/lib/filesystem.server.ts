import fs from "fs";
import path from "path";
import { getConfigDir } from "./helpers.server";

const WORKSPACES_DIR_NAME = "workspaces";

function getWorkspacesRoot(): string {
  return path.join(getConfigDir(), WORKSPACES_DIR_NAME);
}

function validateProjectId(projectId: string): void {
  const trimmed = String(projectId || "").trim();
  if (!trimmed) throw new Error("Project ID is required");
  // Block directory traversal
  if (
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.startsWith(".")
  ) {
    throw new Error("Invalid project ID: must not contain path separators or traversal sequences");
  }
}

export function getProjectWorkspace(projectId: string): string {
  validateProjectId(projectId);
  const workspacesRoot = getWorkspacesRoot();
  const workspaceDir = path.join(workspacesRoot, projectId);
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }
  return workspaceDir;
}

export function resolveInWorkspace(
  projectId: string,
  relativePath: string
): string {
  validateProjectId(projectId);
  const workspaceDir = getProjectWorkspace(projectId);
  const input = String(relativePath || ".").trim();

  // Block absolute paths outside workspace
  if (path.isAbsolute(input)) {
    const resolved = path.resolve(input);
    const normalizedWorkspace = path.resolve(workspaceDir);
    if (!resolved.startsWith(normalizedWorkspace)) {
      throw new Error("Path is outside workspace directory");
    }
    return resolved;
  }

  const candidate = path.join(workspaceDir, input);
  const resolved = path.resolve(candidate);
  const normalizedWorkspace = path.resolve(workspaceDir);
  if (!resolved.startsWith(normalizedWorkspace)) {
    throw new Error("Path is outside workspace directory");
  }
  return resolved;
}

export function listWorkspaces(): string[] {
  const root = getWorkspacesRoot();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
