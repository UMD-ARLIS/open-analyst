/**
 * Vitest globalSetup — starts an ephemeral pgvector container once per run.
 * All workers share the same container; it is destroyed in teardown().
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const TMP_URL_FILE = path.join("/tmp", "oa-test-db-url");

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();

  const url = container.getConnectionUri();

  // Apply the drizzle migration
  const migrationPath = path.resolve(__dirname, "../../drizzle/0000_salty_vengeance.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  for (const stmt of statements) {
    await client.query(stmt);
  }
  await client.end();

  // Write the URL so worker processes can pick it up
  fs.writeFileSync(TMP_URL_FILE, url, "utf-8");
}

export async function teardown() {
  try {
    fs.unlinkSync(TMP_URL_FILE);
  } catch {
    // ignore
  }
  if (container) {
    await container.stop();
  }
}
