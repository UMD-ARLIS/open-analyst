/**
 * Server-side in-memory token store.
 * Keeps JWTs out of cookies to avoid exceeding browser cookie size limits.
 */

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

const store = new Map<string, StoredTokens>();

export function setTokens(userId: string, tokens: StoredTokens): void {
  store.set(userId, tokens);
}

export function getTokens(userId: string): StoredTokens | undefined {
  return store.get(userId);
}

export function deleteTokens(userId: string): void {
  store.delete(userId);
}
