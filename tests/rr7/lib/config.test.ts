import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import {
  loadConfig,
  saveConfig,
  maskApiKey,
} from "../../../app/lib/config.server";

describe("config.server", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("loadConfig returns defaults when no file exists", () => {
    const config = loadConfig(tempDir);
    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("");
    expect(config.model).toBe("anthropic/claude-sonnet-4");
  });

  it("saveConfig persists and loadConfig round-trips", () => {
    saveConfig({ provider: "anthropic", apiKey: "sk-test-123", model: "claude-3" }, tempDir);
    const loaded = loadConfig(tempDir);
    expect(loaded.provider).toBe("anthropic");
    expect(loaded.apiKey).toBe("sk-test-123");
    expect(loaded.model).toBe("claude-3");
  });

  it("maskApiKey masks correctly", () => {
    expect(maskApiKey("sk-test-123")).toBe("***");
    expect(maskApiKey("")).toBe("");
  });
});
