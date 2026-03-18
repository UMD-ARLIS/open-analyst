import { eq, desc, and, or, sql } from "drizzle-orm";
import { db } from "../index.server";
import {
  collections,
  documents,
  type Collection,
  type Document,
} from "../schema";
import {
  buildKnowledgeEmbeddingText,
  embedKnowledgeTexts,
  isKnowledgeEmbeddingConfigured,
} from "~/lib/knowledge-embedding.server";

// --- Collections ---

export async function listCollections(
  projectId: string
): Promise<Collection[]> {
  return db
    .select()
    .from(collections)
    .where(eq(collections.projectId, projectId))
    .orderBy(desc(collections.updatedAt));
}

export async function createCollection(
  projectId: string,
  input: { name?: string; description?: string }
): Promise<Collection> {
  const [collection] = await db
    .insert(collections)
    .values({
      projectId,
      name: String(input.name || "Untitled Collection").trim(),
      description: String(input.description || "").trim(),
    })
    .returning();
  return collection;
}

export async function getCollection(
  projectId: string,
  collectionId: string
): Promise<Collection | undefined> {
  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.projectId, projectId),
        eq(collections.id, collectionId)
      )
    )
    .limit(1);
  return collection;
}

export async function ensureCollection(
  projectId: string,
  name: string,
  description = ""
): Promise<Collection> {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("Collection name is required");

  // Try to find existing (case-insensitive)
  const [existing] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.projectId, projectId),
        sql`lower(${collections.name}) = lower(${trimmed})`
      )
    )
    .limit(1);

  if (existing) return existing;

  try {
    const [collection] = await db
      .insert(collections)
      .values({
        projectId,
        name: trimmed,
        description: String(description || "").trim(),
      })
      .returning();
    return collection;
  } catch (error: unknown) {
    // Race condition: another request created it first, fetch it
    const [raced] = await db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.projectId, projectId),
          sql`lower(${collections.name}) = lower(${trimmed})`
        )
      )
      .limit(1);
    if (raced) return raced;
    throw error;
  }
}

export async function getCollectionDocumentCounts(
  projectId: string
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      collectionId: documents.collectionId,
      count: sql<number>`count(*)::int`,
    })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .groupBy(documents.collectionId);

  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.collectionId) {
      counts[row.collectionId] = row.count;
    }
  }
  return counts;
}

// --- Documents ---

export async function listDocuments(
  projectId: string,
  collectionId?: string
): Promise<Document[]> {
  if (collectionId) {
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.projectId, projectId),
          eq(documents.collectionId, collectionId)
        )
      )
      .orderBy(desc(documents.updatedAt));
  }
  return db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.updatedAt));
}

export async function getDocument(
  projectId: string,
  documentId: string
): Promise<Document | undefined> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.projectId, projectId), eq(documents.id, documentId))
    )
    .limit(1);
  return doc;
}

export async function getDocumentBySourceUri(
  projectId: string,
  sourceUri: string,
  sourceType?: string | null,
): Promise<Document | undefined> {
  const trimmed = String(sourceUri || "").trim();
  if (!trimmed) return undefined;

  const predicates = [
    eq(documents.projectId, projectId),
    eq(documents.sourceUri, trimmed),
  ];
  const trimmedSourceType = String(sourceType || "").trim();
  if (trimmedSourceType) {
    predicates.push(eq(documents.sourceType, trimmedSourceType));
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(...predicates))
    .limit(1);
  return doc;
}

export async function createDocument(
  projectId: string,
  input: {
    collectionId?: string | null;
    title?: string;
    sourceType?: string;
    sourceUri?: string;
    storageUri?: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Document> {
  const [doc] = await db
    .insert(documents)
    .values({
      projectId,
      collectionId: input.collectionId || null,
      title: String(input.title || "Untitled Source").trim(),
      sourceType: String(input.sourceType || "manual"),
      sourceUri: String(input.sourceUri || ""),
      storageUri: input.storageUri || null,
      content: String(input.content || ""),
      metadata:
        input.metadata && typeof input.metadata === "object"
          ? input.metadata
          : {},
    })
    .returning();
  return doc;
}

export async function updateDocument(
  projectId: string,
  documentId: string,
  input: {
    collectionId?: string | null;
    title?: string;
    sourceType?: string;
    sourceUri?: string;
    storageUri?: string | null;
    content?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Document> {
  const [doc] = await db
    .update(documents)
    .set({
      collectionId:
        input.collectionId !== undefined ? input.collectionId || null : undefined,
      title:
        input.title !== undefined
          ? String(input.title || "Untitled Source").trim()
          : undefined,
      sourceType:
        input.sourceType !== undefined
          ? String(input.sourceType || "manual")
          : undefined,
      sourceUri:
        input.sourceUri !== undefined ? String(input.sourceUri || "") : undefined,
      storageUri:
        input.storageUri !== undefined ? input.storageUri || null : undefined,
      content:
        input.content !== undefined ? String(input.content || "") : undefined,
      metadata:
        input.metadata && typeof input.metadata === "object"
          ? input.metadata
          : input.metadata === undefined
            ? undefined
            : {},
      updatedAt: new Date(),
    })
    .where(
      and(eq(documents.projectId, projectId), eq(documents.id, documentId))
    )
    .returning();
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  return doc;
}

export async function updateDocumentMetadata(
  projectId: string,
  documentId: string,
  metadata: Record<string, unknown>
): Promise<Document> {
  const [doc] = await db
    .update(documents)
    .set({
      metadata,
      updatedAt: new Date(),
    })
    .where(
      and(eq(documents.projectId, projectId), eq(documents.id, documentId))
    )
    .returning();
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  return doc;
}

export async function updateDocumentEmbedding(
  projectId: string,
  documentId: string,
  embedding: number[] | null
): Promise<Document> {
  const [doc] = await db
    .update(documents)
    .set({
      embedding,
      embeddingVector: embedding,
      updatedAt: new Date(),
    })
    .where(
      and(eq(documents.projectId, projectId), eq(documents.id, documentId))
    )
    .returning();
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  return doc;
}

export async function updateDocumentEmbeddingVector(
  projectId: string,
  documentId: string,
  embeddingVector: number[] | null
): Promise<Document> {
  const [doc] = await db
    .update(documents)
    .set({
      embeddingVector,
      updatedAt: new Date(),
    })
    .where(
      and(eq(documents.projectId, projectId), eq(documents.id, documentId))
    )
    .returning();
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  return doc;
}

export async function deleteDocument(
  projectId: string,
  documentId: string
): Promise<Document | undefined> {
  const [deleted] = await db
    .delete(documents)
    .where(
      and(eq(documents.projectId, projectId), eq(documents.id, documentId))
    )
    .returning();
  return deleted;
}

// --- RAG query (in-memory TF-IDF, same as before) ---

export interface RagResult {
  id: string;
  title: string | null;
  sourceUri: string | null;
  score: number;
  snippet: string;
  metadata: unknown;
}

export interface RagQueryResult {
  query: string;
  queryVariants: string[];
  totalCandidates: number;
  results: RagResult[];
  status?: "ok" | "degraded" | "error";
  error?: string | null;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at", "by",
  "with", "from", "is", "are", "was", "were", "be", "been", "being", "that",
  "this", "it", "as", "about", "what", "which", "who", "when", "where", "why",
  "how",
]);

function tokenize(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeToken(token: string): string {
  let t = String(token || "").trim().toLowerCase();
  if (t.length > 4 && t.endsWith("ing")) t = t.slice(0, -3);
  if (t.length > 3 && t.endsWith("ed")) t = t.slice(0, -2);
  if (t.length > 3 && t.endsWith("es")) t = t.slice(0, -2);
  if (t.length > 2 && t.endsWith("s")) t = t.slice(0, -1);
  return t;
}

function buildQueryVariants(query: string): string[] {
  const raw = String(query || "").trim();
  if (!raw) return [];
  const variants = new Set([raw]);
  const splitters = /\b(?:and|or|then|vs|versus)\b|[,;]+/gi;
  const parts = raw.split(splitters).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) variants.add(part);
  if (parts.length > 1) variants.add(parts.join(" "));
  return Array.from(variants).slice(0, 6);
}

function tokenizeQuery(query: string): string[] {
  const base = tokenize(query)
    .map(normalizeToken)
    .filter((t) => t && !STOPWORDS.has(t));
  return Array.from(new Set(base)).slice(0, 32);
}

function extractSnippet(content: string, queryTokens: string[]): string {
  const text = String(content || "");
  if (!text) return "";
  const lower = text.toLowerCase();
  for (const token of queryTokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0) {
      const start = Math.max(0, idx - 120);
      const end = Math.min(text.length, idx + 280);
      return text.slice(start, end);
    }
  }
  return text.slice(0, 280);
}

export async function queryDocuments(
  projectId: string,
  query: string,
  options: { limit?: number; collectionId?: string } = {}
): Promise<RagQueryResult> {
  const limit = Math.min(20, Math.max(1, Number(options.limit || 8)));
  const variants = buildQueryVariants(query);
  const totalCandidates = await countDocuments(projectId, options.collectionId);
  const semanticQueryText = buildKnowledgeEmbeddingText({
    title: query,
    content: query,
  });

  if (semanticQueryText && isKnowledgeEmbeddingConfigured()) {
    try {
      const [embedding] = await embedKnowledgeTexts([semanticQueryText]);
      const queryEmbedding = embedding || null;
      if (!queryEmbedding?.length) {
        return {
          query,
          queryVariants: variants,
          totalCandidates,
          results: [],
          status: "error",
          error: "Embedding service returned no query vector.",
        };
      }
      const vectorRows = await queryDocumentsByVector(projectId, queryEmbedding, {
        limit,
        collectionId: options.collectionId,
      });
      return {
        query,
        queryVariants: variants,
        totalCandidates,
        results: vectorRows.map((row) => ({
          id: row.id,
          title: row.title,
          sourceUri: row.sourceUri,
          score: Number(row.score.toFixed(3)),
          snippet: extractSnippet(row.content || "", tokenizeQuery(query)),
          metadata: row.metadata || {},
        })),
        status: "ok",
        error: null,
      };
    } catch (error) {
      return {
        query,
        queryVariants: variants,
        totalCandidates,
        results: [],
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const fallbackRows = await queryDocumentsByTextFallback(projectId, variants, {
    limit,
    collectionId: options.collectionId,
  });

  return {
    query,
    queryVariants: variants,
    totalCandidates,
    results: fallbackRows.map((row) => ({
      id: row.id,
      title: row.title,
      sourceUri: row.sourceUri,
      score: Number(row.score.toFixed(3)),
      snippet: extractSnippet(row.content || "", tokenizeQuery(query)),
      metadata: row.metadata || {},
    })),
    status: "degraded",
    error: null,
  };
}

async function queryDocumentsByVector(
  projectId: string,
  embedding: number[],
  options: { limit?: number; collectionId?: string } = {}
): Promise<Array<{
  id: string;
  title: string | null;
  sourceUri: string | null;
  content: string;
  metadata: unknown;
  score: number;
}>> {
  const normalized = normalizeEmbedding(embedding);
  if (!normalized.length) {
    return [];
  }
  const limit = Math.min(50, Math.max(1, Number(options.limit || 8)));
  const vectorLiteral = sql.raw(`'${toVectorLiteral(normalized)}'::vector`);
  const clauses = [eq(documents.projectId, projectId), sql`${documents.embeddingVector} is not null`];
  if (options.collectionId) {
    clauses.push(eq(documents.collectionId, options.collectionId));
  }
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      sourceUri: documents.sourceUri,
      content: documents.content,
      metadata: documents.metadata,
      score: sql<number>`greatest(0, (1 - (${documents.embeddingVector} <=> ${vectorLiteral})) * 8)`,
    })
    .from(documents)
    .where(and(...clauses))
    .orderBy(sql`${documents.embeddingVector} <=> ${vectorLiteral}`)
    .limit(limit);
  return rows.filter((row) => Number.isFinite(row.score) && row.score > 0);
}

async function queryDocumentsByTextFallback(
  projectId: string,
  variants: string[],
  options: { limit?: number; collectionId?: string } = {},
): Promise<Array<{
  id: string;
  title: string | null;
  sourceUri: string | null;
  content: string;
  metadata: unknown;
  score: number;
}>> {
  const limit = Math.min(50, Math.max(1, Number(options.limit || 8)));
  const terms = variants.map((variant) => variant.trim()).filter(Boolean).slice(0, 6);
  if (!terms.length) {
    return [];
  }

  const searchPredicates = terms.map((term) =>
    or(
      sql`${documents.title} ilike ${`%${term}%`}`,
      sql`${documents.content} ilike ${`%${term}%`}`,
    ),
  );
  const clauses = [
    eq(documents.projectId, projectId),
    ...(options.collectionId ? [eq(documents.collectionId, options.collectionId)] : []),
    or(...searchPredicates),
  ];
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      sourceUri: documents.sourceUri,
      content: documents.content,
      metadata: documents.metadata,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...clauses))
    .orderBy(desc(documents.updatedAt))
    .limit(Math.max(limit * 3, 18));

  return rows
    .map((row) => {
      const lowered = `${row.title || ""} ${row.content || ""}`.toLowerCase();
      const score = terms.reduce((current, term) => {
        const normalized = term.toLowerCase();
        if (!normalized) return current;
        if (lowered.includes(normalized)) {
          return current + 2.5;
        }
        const tokens = tokenizeQuery(normalized);
        return current + tokens.reduce((tokenScore, token) => (
          lowered.includes(token) ? tokenScore + 0.35 : tokenScore
        ), 0);
      }, 0);
      return {
        ...row,
        score,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function countDocuments(projectId: string, collectionId?: string): Promise<number> {
  const clauses = [
    eq(documents.projectId, projectId),
    ...(collectionId ? [eq(documents.collectionId, collectionId)] : []),
  ];
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(...clauses));
  return Number(row?.count || 0);
}

function normalizeEmbedding(values: number[]): number[] {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function toVectorLiteral(values: number[]): string {
  return `[${normalizeEmbedding(values).join(",")}]`;
}
