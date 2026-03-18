/**
 * Proxy route that forwards all /api/runtime/* requests to the LangGraph Agent Server.
 *
 * The Agent Server runs on RUNTIME_URL (default http://localhost:8081) and provides
 * the standard LangGraph API for threads, runs, assistants, and streaming.
 *
 * The frontend's `useStream` hook connects through this proxy so that:
 * - The web app can inject auth/project context
 * - CORS is avoided (same-origin requests)
 * - The runtime URL is not exposed to the browser
 */

import { buildRuntimeConfigurable } from "~/lib/runtime-context.server";

const RUNTIME_URL = process.env.RUNTIME_URL || "http://localhost:8081";

type RuntimeProxyBody = {
  input?: {
    messages?: Array<{
      role?: string;
      content?: unknown;
    }>;
  };
  config?: {
    configurable?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
};

const DEEP_RESEARCH_SYSTEM_PROMPT = [
  "Deep research mode is active.",
  "Plan before acting, delegate evidence collection to the researcher first,",
  "use grounded sources, and synthesize only after retrieval has produced enough support.",
].join(" ");

function getBodyProjectId(body: RuntimeProxyBody): string {
  const configProjectId = body.config?.configurable?.project_id;
  if (typeof configProjectId === "string" && configProjectId.trim()) {
    return configProjectId.trim();
  }
  const metadataProjectId = body.metadata?.project_id;
  if (typeof metadataProjectId === "string" && metadataProjectId.trim()) {
    return metadataProjectId.trim();
  }
  return "";
}

function getBodyCollectionId(body: RuntimeProxyBody): string | null {
  const collectionId = body.config?.configurable?.collection_id;
  if (typeof collectionId === "string" && collectionId.trim()) {
    return collectionId.trim();
  }
  return null;
}

function getBodyAnalysisMode(body: RuntimeProxyBody): string {
  const configMode = body.config?.configurable?.analysis_mode;
  if (typeof configMode === "string" && configMode.trim()) {
    return configMode.trim();
  }
  const metadataMode = body.metadata?.analysis_mode;
  if (typeof metadataMode === "string" && metadataMode.trim()) {
    return metadataMode.trim();
  }
  return "chat";
}

function applyAnalysisMode(body: RuntimeProxyBody, analysisMode: string): RuntimeProxyBody {
  if (analysisMode !== "deep_research") {
    return body;
  }
  const messages = Array.isArray(body.input?.messages) ? body.input.messages : [];
  const firstMessage = messages[0];
  const alreadyPrepended = firstMessage?.role === "system"
    && typeof firstMessage.content === "string"
    && firstMessage.content.includes("Deep research mode is active.");
  if (alreadyPrepended) {
    return body;
  }
  return {
    ...body,
    input: {
      ...(body.input || {}),
      messages: [
        { role: "system", content: DEEP_RESEARCH_SYSTEM_PROMPT },
        ...messages,
      ],
    },
  };
}

async function buildForwardedInit(request: Request): Promise<RequestInit> {
  const requestUrl = new URL(request.url);
  const isThreadCreateRequest =
    request.method === "POST" && requestUrl.pathname === "/api/runtime/threads";
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method === "GET" || request.method === "HEAD") {
    return init;
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (request.body) {
      init.body = request.body;
      // @ts-expect-error -- duplex is needed for streaming request bodies
      init.duplex = "half";
    }
    return init;
  }

  const body = await request.clone().json().catch(() => null) as RuntimeProxyBody | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    if (request.body) {
      init.body = request.body;
      // @ts-expect-error -- duplex is needed for streaming request bodies
      init.duplex = "half";
    }
    return init;
  }

  const projectId = getBodyProjectId(body);
  if (!projectId) {
    init.body = JSON.stringify(body);
    return init;
  }

  if (isThreadCreateRequest) {
    init.body = JSON.stringify({
      ...body,
      metadata: {
        ...(body.metadata || {}),
        project_id: projectId,
        analysis_mode: getBodyAnalysisMode(body),
      },
    });
    return init;
  }

  const analysisMode = getBodyAnalysisMode(body);
  const runtimeConfigurable = await buildRuntimeConfigurable(projectId, {
    request,
    collectionId: getBodyCollectionId(body),
    analysisMode,
  });

  init.body = JSON.stringify(
    applyAnalysisMode(
      {
        ...body,
        config: {
          ...(body.config || {}),
          configurable: {
            ...(body.config?.configurable || {}),
            ...runtimeConfigurable,
          },
        },
        metadata: {
          ...(body.metadata || {}),
          project_id: projectId,
          analysis_mode: analysisMode,
        },
      },
      analysisMode,
    ),
  );
  return init;
}

async function proxyToAgentServer(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetPath = url.pathname.replace("/api/runtime", "");
  const targetUrl = `${RUNTIME_URL}${targetPath}${url.search}`;

  try {
    const init = await buildForwardedInit(request);
    const response = await fetch(targetUrl, init);

    // Forward the response with headers
    const responseHeaders = new Headers(response.headers);
    // Remove transfer-encoding to avoid double-chunking
    responseHeaders.delete("transfer-encoding");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[runtime proxy] Failed to reach Agent Server:", error);
    return Response.json(
      { error: "Agent Server is not reachable. Is it running?" },
      { status: 502 }
    );
  }
}

export async function loader({ request }: { request: Request }) {
  return proxyToAgentServer(request);
}

export async function action({ request }: { request: Request }) {
  return proxyToAgentServer(request);
}
