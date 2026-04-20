import { queryRow } from '../index.server';

export interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

let ensurePromise: Promise<void> | null = null;

async function ensureAuthSessionsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await queryRow(
        `
          CREATE TABLE IF NOT EXISTS auth_sessions (
            user_id TEXT PRIMARY KEY,
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            id_token TEXT NOT NULL,
            expires_at BIGINT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `
      );
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

function normalizeTokens(input: Partial<StoredAuthTokens>): StoredAuthTokens {
  return {
    accessToken: String(input.accessToken || ''),
    refreshToken: String(input.refreshToken || ''),
    idToken: String(input.idToken || ''),
    expiresAt: Number(input.expiresAt || 0) || 0,
  };
}

export async function getStoredAuthTokens(userId: string): Promise<StoredAuthTokens | undefined> {
  await ensureAuthSessionsTable();
  const row = await queryRow<StoredAuthTokens>(
    `
      SELECT access_token, refresh_token, id_token, expires_at
      FROM auth_sessions
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );
  return row ? normalizeTokens(row) : undefined;
}

export async function upsertStoredAuthTokens(
  userId: string,
  tokens: StoredAuthTokens
): Promise<void> {
  await ensureAuthSessionsTable();
  const normalized = normalizeTokens(tokens);
  await queryRow(
    `
      INSERT INTO auth_sessions (
        user_id,
        access_token,
        refresh_token,
        id_token,
        expires_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        id_token = EXCLUDED.id_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `,
    [
      userId,
      normalized.accessToken,
      normalized.refreshToken,
      normalized.idToken,
      normalized.expiresAt,
    ]
  );
}

export async function deleteStoredAuthTokens(userId: string): Promise<void> {
  await ensureAuthSessionsTable();
  await queryRow(
    `
      DELETE FROM auth_sessions
      WHERE user_id = $1
    `,
    [userId]
  );
}
