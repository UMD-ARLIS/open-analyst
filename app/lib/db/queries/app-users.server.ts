import { queryRow, queryRows } from '../index.server';
import type { AppUser } from '../schema';

let ensurePromise: Promise<void> | null = null;

export async function ensureAppUsersTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await queryRow(`
        CREATE TABLE IF NOT EXISTS app_users (
          user_id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          username TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await queryRow(
        `CREATE INDEX IF NOT EXISTS idx_app_users_email_lower ON app_users ((lower(email)))`
      );
      await queryRow(
        `CREATE INDEX IF NOT EXISTS idx_app_users_username_lower ON app_users ((lower(username)))`
      );
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

export async function upsertAppUser(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
}): Promise<AppUser> {
  await ensureAppUsersTable();
  const user = await queryRow<AppUser>(
    `
      INSERT INTO app_users (user_id, email, name, username, last_seen_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        username = EXCLUDED.username,
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.userId,
      input.email ? String(input.email).trim() || null : null,
      input.name ? String(input.name).trim() || null : null,
      input.username ? String(input.username).trim() || null : null,
    ]
  );
  if (!user) throw new Error(`Failed to upsert app user ${input.userId}`);
  return user;
}

export async function findAppUserByIdentifier(identifier: string): Promise<AppUser | undefined> {
  await ensureAppUsersTable();
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return queryRow<AppUser>(
    `
      SELECT *
      FROM app_users
      WHERE lower(coalesce(email, '')) = $1
         OR lower(coalesce(username, '')) = $1
      LIMIT 1
    `,
    [normalized]
  );
}

export async function listAppUsers(limit = 20): Promise<AppUser[]> {
  await ensureAppUsersTable();
  return queryRows<AppUser>(
    `
      SELECT *
      FROM app_users
      ORDER BY last_seen_at DESC NULLS LAST, updated_at DESC
      LIMIT $1
    `,
    [Math.max(1, Math.min(limit, 100))]
  );
}
