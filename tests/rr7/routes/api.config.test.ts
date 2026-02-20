import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempDataDir, cleanupTempDataDir } from "../setup";
import { loader, action } from "../../../app/routes/api.config";
import { createMockActionArgs, getJsonResponse } from "./helpers";

describe("api.config", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDataDir();
  });

  afterEach(() => {
    cleanupTempDataDir(tempDir);
  });

  it("GET returns config with masked key", async () => {
    const response = await loader();
    const data = (await getJsonResponse(response)) as Record<string, unknown>;
    expect(data.provider).toBe("openai");
    expect(data.apiKey).toBe("");
  });

  it("POST saves config", async () => {
    const args = createMockActionArgs("POST", "/api/config", {
      provider: "anthropic",
      apiKey: "sk-test",
    });
    const response = await action(args as never);
    const data = (await getJsonResponse(response)) as { success: boolean; config: Record<string, unknown> };
    expect(data.success).toBe(true);
    expect(data.config.provider).toBe("anthropic");
    expect(data.config.apiKey).toBe("***");
  });
});
