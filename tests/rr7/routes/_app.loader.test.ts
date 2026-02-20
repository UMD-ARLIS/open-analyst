import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import { loader } from "../../../app/routes/_app.loader.server";
import fs from "fs";
import path from "path";

describe("_app layout loader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("returns projects array with at least one default project", async () => {
    const data = await loader();
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects.length).toBeGreaterThanOrEqual(1);
    expect(data.projects[0]).toHaveProperty("id");
    expect(data.projects[0]).toHaveProperty("name");
  });

  it("returns activeProjectId as string or null", async () => {
    const data = await loader();
    expect(
      typeof data.activeProjectId === "string" ||
        data.activeProjectId === null
    ).toBe(true);
  });

  it("returns workingDir as a string", async () => {
    const data = await loader();
    expect(typeof data.workingDir).toBe("string");
  });

  it("returns isConfigured: false when server config has empty apiKey", async () => {
    const configPath = path.join(tempDir, "headless-config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ apiKey: "", provider: "openai" }),
      "utf8"
    );
    const data = await loader();
    expect(data.isConfigured).toBe(false);
  });

  it("returns isConfigured: true when server config has non-empty apiKey", async () => {
    const configPath = path.join(tempDir, "headless-config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ apiKey: "sk-test-key-123", provider: "openai" }),
      "utf8"
    );
    const data = await loader();
    expect(data.isConfigured).toBe(true);
  });

  it("does NOT expose raw apiKey in loader response", async () => {
    const configPath = path.join(tempDir, "headless-config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ apiKey: "sk-secret-key-456", provider: "openai" }),
      "utf8"
    );
    const data = await loader();
    const json = JSON.stringify(data);
    expect(json).not.toContain("sk-secret-key-456");
    expect(data).not.toHaveProperty("apiKey");
  });
});
