import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    LITELLM_BASE_URL: z.string().url().default("http://localhost:4000"),
    LITELLM_API_KEY: z.string().min(1, "LITELLM_API_KEY is required"),
    STRANDS_URL: z.string().url().default("http://localhost:8080"),
  },
  runtimeEnv: process.env,
});
