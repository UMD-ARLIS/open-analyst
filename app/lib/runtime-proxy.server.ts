import { env } from '~/lib/env.server';
import { requireApiUser } from '~/lib/auth/require-user.server';
import { getProject } from '~/lib/db/queries/projects.server';

const RUNTIME_URL = env.LANGGRAPH_RUNTIME_URL.replace(/\/+$/g, '');
const DEFAULT_TIMEOUT_MS = 30_000;

type RuntimeFetchInit = RequestInit & {
  timeoutMs?: number | null;
};

export interface RuntimeThreadSummary {
  thread_id: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  status?: string | null;
  current_run_id?: string | null;
}

function jsonHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  return headers;
}

export function runtimeRequestHeaders(request: Request, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set('X-Open-Analyst-Web-Url', new URL(request.url).origin);
  return headers;
}

export async function runtimeFetch(path: string, init: RuntimeFetchInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : init.timeoutMs;
  const timeout =
    typeof timeoutMs === 'number' && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
  try {
    return await fetch(`${RUNTIME_URL}${path}`, {
      ...init,
      headers: init.headers ? new Headers(init.headers) : undefined,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function runtimeJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await runtimeFetch(path, {
    ...init,
    headers: jsonHeaders(init.headers),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object'
        ? String((payload as Record<string, unknown>).detail || (payload as Record<string, unknown>).error || response.statusText)
        : response.statusText;
    throw new Response(JSON.stringify({ error: detail || `HTTP ${response.status}` }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return payload as T;
}

export function passthroughHeaders(response: Response, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  for (const key of [
    'content-type',
    'cache-control',
    'etag',
    'last-modified',
    'x-accel-buffering',
  ]) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

export async function requireRuntimeProjectAccess(request: Request, projectId: string) {
  const user = await requireApiUser(request);
  const project = await getProject(projectId, user.userId);
  if (!project) {
    throw new Response(JSON.stringify({ error: `Project not found: ${projectId}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return { user, project };
}

export async function requireRuntimeThreadAccess(request: Request, threadId: string) {
  const user = await requireApiUser(request);
  const thread = await runtimeJson<RuntimeThreadSummary>(`/threads/${encodeURIComponent(threadId)}`);
  const metadata = thread.metadata && typeof thread.metadata === 'object' ? thread.metadata : {};
  const projectId = typeof metadata.project_id === 'string' ? metadata.project_id.trim() : '';
  if (!projectId) {
    throw new Response(JSON.stringify({ error: 'Thread is missing project metadata' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const project = await getProject(projectId, user.userId);
  if (!project) {
    throw new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return { user, project, thread };
}
