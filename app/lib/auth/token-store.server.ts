import {
  deleteStoredAuthTokens,
  getStoredAuthTokens,
  upsertStoredAuthTokens,
  type StoredAuthTokens,
} from '~/lib/db/queries/auth-sessions.server';

export type { StoredAuthTokens };

export async function setTokens(userId: string, tokens: StoredAuthTokens): Promise<void> {
  await upsertStoredAuthTokens(userId, tokens);
}

export async function getTokens(userId: string): Promise<StoredAuthTokens | undefined> {
  return getStoredAuthTokens(userId);
}

export async function deleteTokens(userId: string): Promise<void> {
  await deleteStoredAuthTokens(userId);
}
