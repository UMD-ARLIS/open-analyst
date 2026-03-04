import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import {
  getProjectWorkspace,
  resolveInWorkspace,
  listWorkspaces,
} from "~/lib/filesystem.server";

describe("filesystem.server", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  describe("getProjectWorkspace", () => {
    it("creates directory and returns path", () => {
      const ws = getProjectWorkspace("proj-abc");
      expect(fs.existsSync(ws)).toBe(true);
      expect(ws).toContain("workspaces");
      expect(ws).toContain("proj-abc");
    });

    it("returns same path on repeated calls", () => {
      const ws1 = getProjectWorkspace("proj-abc");
      const ws2 = getProjectWorkspace("proj-abc");
      expect(ws1).toBe(ws2);
    });

    it("throws on traversal attempt", () => {
      expect(() => getProjectWorkspace("../evil")).toThrow(
        "Invalid project ID"
      );
    });

    it("throws on empty project ID", () => {
      expect(() => getProjectWorkspace("")).toThrow(
        "Project ID is required"
      );
    });

    it("throws on path with slashes", () => {
      expect(() => getProjectWorkspace("foo/bar")).toThrow(
        "Invalid project ID"
      );
    });
  });

  describe("resolveInWorkspace", () => {
    it("resolves correctly inside workspace", () => {
      const resolved = resolveInWorkspace("proj-abc", "subdir/file.txt");
      expect(resolved).toContain("proj-abc");
      expect(resolved).toContain("subdir");
      expect(resolved).toContain("file.txt");
    });

    it("resolves '.' to workspace root", () => {
      const ws = getProjectWorkspace("proj-abc");
      const resolved = resolveInWorkspace("proj-abc", ".");
      expect(resolved).toBe(ws);
    });

    it("throws on directory traversal with ../", () => {
      expect(() =>
        resolveInWorkspace("proj-abc", "../../etc/passwd")
      ).toThrow("Path is outside workspace directory");
    });

    it("throws on absolute path outside workspace", () => {
      expect(() =>
        resolveInWorkspace("proj-abc", "/etc/passwd")
      ).toThrow("Path is outside workspace directory");
    });
  });

  describe("listWorkspaces", () => {
    it("returns empty when no workspaces exist", () => {
      const result = listWorkspaces();
      expect(result).toEqual([]);
    });

    it("returns existing workspace IDs", () => {
      getProjectWorkspace("proj-1");
      getProjectWorkspace("proj-2");
      const result = listWorkspaces();
      expect(result).toContain("proj-1");
      expect(result).toContain("proj-2");
      expect(result).toHaveLength(2);
    });
  });
});
