/**
 * Vitest setupFile — runs in each worker before tests.
 * Reads the container URL written by global-setup.ts and sets DATABASE_URL.
 */
import fs from "node:fs";
import path from "node:path";

const TMP_URL_FILE = path.join("/tmp", "oa-test-db-url");

const url = fs.readFileSync(TMP_URL_FILE, "utf-8").trim();
process.env.DATABASE_URL = url;
