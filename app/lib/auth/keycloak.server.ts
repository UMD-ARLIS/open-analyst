import { Issuer, type Client } from 'openid-client';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://keycloak:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'open-analyst';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'open-analyst-web';
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';
const APP_URL = process.env.OPEN_ANALYST_WEB_URL || 'http://localhost:5173';

// The browser-facing issuer URL (goes through ALB)
const PUBLIC_ISSUER_URL = `${APP_URL}/realms/${KEYCLOAK_REALM}`;
// The server-side issuer URL (in-cluster)
const INTERNAL_ISSUER_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;

let _client: Client | null = null;

async function getClient(): Promise<Client> {
  if (_client) return _client;

  // Discover from the internal URL (avoids TLS issues when APP_URL differs from KEYCLOAK_URL)
  const discovered = await Issuer.discover(INTERNAL_ISSUER_URL);

  // Override the issuer to match the public URL so token validation works
  // (Keycloak sets the issuer based on the incoming request hostname)
  const issuer = new Issuer({
    ...discovered.metadata,
    issuer: PUBLIC_ISSUER_URL,
  });

  _client = new issuer.Client({
    client_id: KEYCLOAK_CLIENT_ID,
    client_secret: KEYCLOAK_CLIENT_SECRET,
    redirect_uris: [`${APP_URL}/auth/callback`],
    response_types: ['code'],
  });

  return _client;
}

export async function getAuthorizationUrl(state: string): Promise<string> {
  // Build the URL manually using the PUBLIC issuer to avoid internal URLs leaking to browser
  // Note: nonce is omitted because we don't persist it in the session for verification
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    scope: 'openid email profile',
    response_type: 'code',
    redirect_uri: `${APP_URL}/auth/callback`,
    state,
  });
  return `${PUBLIC_ISSUER_URL}/protocol/openid-connect/auth?${params.toString()}`;
}

export async function handleCallback(
  callbackUrl: string,
  checks: { state: string },
): Promise<{
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  userId: string;
  email: string;
  name: string;
}> {
  const client = await getClient();
  const params = client.callbackParams(callbackUrl);
  const tokenSet = await client.callback(`${APP_URL}/auth/callback`, params, {
    state: checks.state,
  });

  const claims = tokenSet.claims();

  return {
    accessToken: tokenSet.access_token || '',
    refreshToken: tokenSet.refresh_token || '',
    idToken: tokenSet.id_token || '',
    expiresAt: tokenSet.expires_at || 0,
    userId: claims.sub || '',
    email: (claims.email as string) || '',
    name:
      (claims.preferred_username as string) ||
      (claims.name as string) ||
      (claims.email as string) ||
      '',
  };
}

export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
} | null> {
  try {
    const client = await getClient();
    const tokenSet = await client.refresh(refreshToken);
    return {
      accessToken: tokenSet.access_token || '',
      refreshToken: tokenSet.refresh_token || refreshToken,
      idToken: tokenSet.id_token || '',
      expiresAt: tokenSet.expires_at || 0,
    };
  } catch {
    return null;
  }
}

export function getLogoutUrl(idTokenHint: string): string {
  return `${PUBLIC_ISSUER_URL}/protocol/openid-connect/logout?id_token_hint=${encodeURIComponent(idTokenHint)}&post_logout_redirect_uri=${encodeURIComponent(`${APP_URL}/login`)}`;
}
