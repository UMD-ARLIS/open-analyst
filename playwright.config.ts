import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "pnpm dev:all",
    url: process.env.BASE_URL || "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
