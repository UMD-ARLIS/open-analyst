import { basename } from "node:path";

import {
  createDocument,
  getDocumentBySourceUri,
  updateDocument,
} from "~/lib/db/queries/documents.server";
import { refreshDocumentKnowledgeIndex } from "~/lib/knowledge-index.server";
import type { Task } from "~/lib/db/schema";
import type { McpServerConfig } from "~/lib/types";

interface AnalystPaper {
  canonical_id: string;
  provider: string;
  source_id: string;
  title: string;
  abstract?: string | null;
  url?: string | null;
  pdf_url?: string | null;
}

interface AnalystArtifact {
  kind: string;
  label: string;
  suffix: string;
  path: string;
  mime_type: string;
  artifact_url?: string | null;
  download_url?: string | null;
}

interface AnalystCollectionArtifactsResponse {
  items?: Array<{
    paper: AnalystPaper;
    artifacts: AnalystArtifact[];
  }>;
}

interface AnalystCollectionDetailResponse {
  papers?: AnalystPaper[];
}

interface MirrorResult {
  mirrored: number;
  skipped: string[];
  collectionName: string;
}

function getJsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(value: unknown): string {
  return String(value || "").trim();
}

function findAnalystCollectionName(toolResultData: unknown): string {
  const data = getJsonRecord(toolResultData);
  return firstString(data?.collection_name);
}

function parseJsonText(value: string): unknown {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveToolResultData(toolResultData: unknown, toolOutput?: string): unknown {
  const direct = getJsonRecord(toolResultData);
  if (direct) return direct;
  return parseJsonText(firstString(toolOutput));
}

function findSuccessfulCanonicalIds(toolResultData: unknown): Set<string> {
  const data = getJsonRecord(toolResultData);
  const downloaded = Array.isArray(data?.downloaded) ? data?.downloaded : [];
  return new Set(
    downloaded
      .map((item) => firstString(getJsonRecord(item)?.canonical_id))
      .filter(Boolean)
  );
}

function matchesAnalystTool(toolName: string): boolean {
  return /analyst/i.test(toolName) && /(collect_articles|collect_collection_artifacts|index_collection)$/.test(toolName);
}

function findAnalystServer(mcpServers: McpServerConfig[], toolName: string): McpServerConfig | null {
  if (!matchesAnalystTool(toolName)) return null;
  return (
    mcpServers.find((server) => /analyst/i.test(`${server.alias || ""} ${server.name}`)) ||
    mcpServers.find((server) => /localhost:8000|analyst-mcp/i.test(server.url || "")) ||
    null
  );
}

async function fetchAnalystJson(server: McpServerConfig, path: string): Promise<unknown> {
  const rawUrl = firstString(server.url);
  if (!rawUrl) {
    throw new Error("Analyst MCP server URL is missing");
  }
  const url = new URL(rawUrl);
  const target = new URL(path, `${url.origin}/`);
  const res = await fetch(target, {
    headers: server.headers || {},
  });
  if (!res.ok) {
    throw new Error(`Analyst MCP sync failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

function preferredArtifact(artifacts: AnalystArtifact[]): AnalystArtifact | null {
  return (
    artifacts.find((artifact) => artifact.kind === "pdf") ||
    artifacts.find((artifact) => artifact.kind === "text") ||
    artifacts[0] ||
    null
  );
}

function buildDocumentContent(paper: AnalystPaper): string {
  const lines = [paper.title];
  if (paper.abstract) {
    lines.push("");
    lines.push(paper.abstract);
  }
  return lines.filter(Boolean).join("\n");
}

export async function syncAnalystCollectionToTaskCollection(args: {
  projectId: string;
  task: Task;
  collectionId: string;
  collectionName: string;
  toolName: string;
  toolResultData: unknown;
  toolOutput?: string;
  mcpServers: McpServerConfig[];
}): Promise<MirrorResult | null> {
  const server = findAnalystServer(args.mcpServers, args.toolName);
  const resolvedResultData = resolveToolResultData(args.toolResultData, args.toolOutput);
  const analystCollectionName = findAnalystCollectionName(resolvedResultData);
  if (!server || !analystCollectionName) {
    return null;
  }

  const successfulIds = findSuccessfulCanonicalIds(resolvedResultData);
  if (successfulIds.size === 0) {
    return {
      mirrored: 0,
      skipped: [],
      collectionName: args.collectionName,
    };
  }

  const [detailRaw, artifactsRaw] = await Promise.all([
    fetchAnalystJson(server, `/api/collections/${encodeURIComponent(analystCollectionName)}?limit=200`),
    fetchAnalystJson(server, `/api/collections/${encodeURIComponent(analystCollectionName)}/artifacts?limit=200`),
  ]);

  const detail = getJsonRecord(detailRaw) as AnalystCollectionDetailResponse | null;
  const artifacts = getJsonRecord(artifactsRaw) as AnalystCollectionArtifactsResponse | null;
  const paperById = new Map(
    (Array.isArray(detail?.papers) ? detail!.papers : []).map((paper) => [paper.canonical_id, paper])
  );
  const artifactsById = new Map(
    (Array.isArray(artifacts?.items) ? artifacts!.items : []).map((item) => [
      item.paper.canonical_id,
      item.artifacts || [],
    ])
  );

  let mirrored = 0;
  const skipped: string[] = [];

  for (const canonicalId of successfulIds) {
    const paper = paperById.get(canonicalId);
    if (!paper) {
      skipped.push(`${canonicalId}: missing paper metadata`);
      continue;
    }

    const artifact = preferredArtifact(artifactsById.get(canonicalId) || []);
    const sourceUri = `analyst://${canonicalId}`;
    const metadata = {
      provider: paper.provider,
      sourceId: paper.source_id,
      canonicalId,
      paperUrl: firstString(paper.url),
      pdfUrl: firstString(paper.pdf_url),
      artifactUrl: firstString(artifact?.artifact_url),
      downloadUrl: firstString(artifact?.download_url),
      mimeType: firstString(artifact?.mime_type) || "application/octet-stream",
      filename:
        basename(firstString(artifact?.path || "")) ||
        `${paper.source_id}${firstString(artifact?.suffix) || ".bin"}`,
      analystCollectionName,
      taskId: args.task.id,
      taskCollectionName: args.collectionName,
      mirroredFrom: "analyst_mcp",
    };

    const existing = await getDocumentBySourceUri(args.projectId, sourceUri);
    if (existing) {
      const updated = await updateDocument(args.projectId, existing.id, {
        collectionId: args.collectionId,
        title: paper.title,
        sourceType: "analyst_mcp",
        sourceUri,
        storageUri: firstString(artifact?.path) || existing.storageUri,
        content: buildDocumentContent(paper),
        metadata,
      });
      await refreshDocumentKnowledgeIndex(args.projectId, updated.id);
    } else {
      const created = await createDocument(args.projectId, {
        collectionId: args.collectionId,
        title: paper.title,
        sourceType: "analyst_mcp",
        sourceUri,
        storageUri: firstString(artifact?.path) || null,
        content: buildDocumentContent(paper),
        metadata,
      });
      await refreshDocumentKnowledgeIndex(args.projectId, created.id);
    }
    mirrored += 1;
  }

  return {
    mirrored,
    skipped,
    collectionName: args.collectionName,
  };
}
