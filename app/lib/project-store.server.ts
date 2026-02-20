import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ensureConfigDir, getConfigDir } from "./helpers.server";
import type {
  ProjectData,
  ProjectStore,
  Collection,
  Document,
  Run,
  RunEvent,
  RagResult,
  RagQueryResult,
} from "./types";

const STORE_FILENAME = "projects-store.json";

function now(): number {
  return Date.now();
}

function getStorePath(configDir?: string): string {
  return path.join(configDir ?? getConfigDir(), STORE_FILENAME);
}

function createProjectTemplate(
  input: Partial<ProjectData> & { datastores?: ProjectData["datastores"] } = {}
): ProjectData {
  const ts = now();
  return {
    id: input.id || randomUUID(),
    name: String(input.name || "Untitled Project").trim(),
    description: String(input.description || "").trim(),
    createdAt: ts,
    updatedAt: ts,
    datastores:
      Array.isArray(input.datastores) && input.datastores.length
        ? input.datastores
        : [
            {
              id: randomUUID(),
              name: "local-default",
              type: "local",
              config: { basePath: "" },
              isDefault: true,
            },
          ],
    collections: [],
    documents: [],
    runs: [],
  };
}

function defaultStore(): ProjectStore {
  const defaultProject = createProjectTemplate({
    name: "Default Project",
    description: "Auto-created default project",
  });
  return {
    version: 1,
    activeProjectId: defaultProject.id,
    projects: [defaultProject],
  };
}

function parseStore(raw: unknown): ProjectStore {
  if (!raw || typeof raw !== "object") return defaultStore();
  const obj = raw as Record<string, unknown>;
  const projects = Array.isArray(obj.projects) ? obj.projects : [];
  if (!projects.length) return defaultStore();
  const activeProjectId =
    obj.activeProjectId &&
    projects.some((p: ProjectData) => p.id === obj.activeProjectId)
      ? (obj.activeProjectId as string)
      : projects[0].id;
  return { version: 1, activeProjectId, projects };
}

function loadStore(configDir?: string): ProjectStore {
  const dir = ensureConfigDir(configDir);
  const storePath = path.join(dir, STORE_FILENAME);
  if (!fs.existsSync(storePath)) {
    const initial = defaultStore();
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
    return parseStore(parsed);
  } catch {
    const initial = defaultStore();
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

function saveStore(store: ProjectStore, configDir?: string): void {
  const dir = ensureConfigDir(configDir);
  fs.writeFileSync(
    path.join(dir, STORE_FILENAME),
    JSON.stringify(store, null, 2),
    "utf8"
  );
}

function sortByUpdatedDesc<T extends { updatedAt?: number }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
  );
}

function findProjectOrThrow(
  store: ProjectStore,
  projectId: string
): ProjectData {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}

function touchProject(project: ProjectData): void {
  project.updatedAt = now();
}

// --- Public API ---

export function createProjectStore(configDir?: string) {
  const dir = configDir;

  return {
    get STORE_PATH() {
      return getStorePath(dir);
    },

    createProject(
      input: {
        name?: string;
        description?: string;
        datastores?: ProjectData["datastores"];
      } = {}
    ): ProjectData {
      const store = loadStore(dir);
      const project = createProjectTemplate(input);
      store.projects.push(project);
      store.activeProjectId = project.id;
      saveStore(store, dir);
      return project;
    },

    listProjects(): ProjectData[] {
      const store = loadStore(dir);
      return sortByUpdatedDesc(store.projects);
    },

    getProject(projectId: string): ProjectData | null {
      const store = loadStore(dir);
      return store.projects.find((p) => p.id === projectId) || null;
    },

    setActiveProject(
      projectId: string
    ): { activeProjectId: string } {
      const store = loadStore(dir);
      findProjectOrThrow(store, projectId);
      store.activeProjectId = projectId;
      saveStore(store, dir);
      return { activeProjectId: projectId };
    },

    getActiveProject(): ProjectData | null {
      const store = loadStore(dir);
      const project =
        store.projects.find((p) => p.id === store.activeProjectId) ||
        store.projects[0];
      return project || null;
    },

    updateProject(
      projectId: string,
      updates: {
        name?: string;
        description?: string;
        datastores?: ProjectData["datastores"];
      } = {}
    ): ProjectData {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      if (typeof updates.name === "string") {
        project.name = updates.name.trim() || project.name;
      }
      if (typeof updates.description === "string") {
        project.description = updates.description.trim();
      }
      if (Array.isArray(updates.datastores)) {
        project.datastores = updates.datastores;
      }
      touchProject(project);
      saveStore(store, dir);
      return project;
    },

    deleteProject(projectId: string): { success: boolean } {
      const store = loadStore(dir);
      const before = store.projects.length;
      store.projects = store.projects.filter((p) => p.id !== projectId);
      if (store.projects.length === before) {
        throw new Error(`Project not found: ${projectId}`);
      }
      if (!store.projects.length) {
        const replacement = createProjectTemplate({
          name: "Default Project",
          description: "Auto-created default project",
        });
        store.projects = [replacement];
        store.activeProjectId = replacement.id;
      } else if (store.activeProjectId === projectId) {
        store.activeProjectId = store.projects[0].id;
      }
      saveStore(store, dir);
      return { success: true };
    },

    listCollections(projectId: string): Collection[] {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      return sortByUpdatedDesc(project.collections || []);
    },

    createCollection(
      projectId: string,
      input: { name?: string; description?: string; id?: string } = {}
    ): Collection {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      const ts = now();
      const collection: Collection = {
        id: input.id || randomUUID(),
        name: String(input.name || "Untitled Collection").trim(),
        description: String(input.description || "").trim(),
        createdAt: ts,
        updatedAt: ts,
      };
      project.collections = Array.isArray(project.collections)
        ? project.collections
        : [];
      project.collections.push(collection);
      touchProject(project);
      saveStore(store, dir);
      return collection;
    },

    ensureCollection(
      projectId: string,
      name: string,
      description = ""
    ): Collection {
      const trimmed = String(name || "").trim();
      if (!trimmed) throw new Error("Collection name is required");
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      project.collections = Array.isArray(project.collections)
        ? project.collections
        : [];
      const existing = project.collections.find(
        (item) => item.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) return existing;
      const ts = now();
      const collection: Collection = {
        id: randomUUID(),
        name: trimmed,
        description: String(description || "").trim(),
        createdAt: ts,
        updatedAt: ts,
      };
      project.collections.push(collection);
      touchProject(project);
      saveStore(store, dir);
      return collection;
    },

    listDocuments(projectId: string, collectionId?: string): Document[] {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      const all = Array.isArray(project.documents) ? project.documents : [];
      const filtered = collectionId
        ? all.filter((doc) => doc.collectionId === collectionId)
        : all;
      return sortByUpdatedDesc(filtered);
    },

    createDocument(
      projectId: string,
      input: {
        id?: string;
        collectionId?: string | null;
        title?: string;
        sourceType?: string;
        sourceUri?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      } = {}
    ): Document {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      const ts = now();
      const doc: Document = {
        id: input.id || randomUUID(),
        collectionId: input.collectionId || null,
        title: String(input.title || "Untitled Source").trim(),
        sourceType: String(input.sourceType || "manual"),
        sourceUri: String(input.sourceUri || ""),
        content: String(input.content || ""),
        metadata:
          input.metadata && typeof input.metadata === "object"
            ? input.metadata
            : {},
        createdAt: ts,
        updatedAt: ts,
      };
      project.documents = Array.isArray(project.documents)
        ? project.documents
        : [];
      project.documents.push(doc);
      touchProject(project);
      saveStore(store, dir);
      return doc;
    },

    createRun(
      projectId: string,
      input: {
        id?: string;
        type?: string;
        status?: string;
        prompt?: string;
        output?: string;
        events?: RunEvent[];
      } = {}
    ): Run {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      const ts = now();
      const run: Run = {
        id: input.id || randomUUID(),
        type: String(input.type || "chat"),
        status: String(input.status || "running"),
        prompt: String(input.prompt || ""),
        output: String(input.output || ""),
        events: Array.isArray(input.events) ? input.events : [],
        createdAt: ts,
        updatedAt: ts,
      };
      project.runs = Array.isArray(project.runs) ? project.runs : [];
      project.runs.push(run);
      touchProject(project);
      saveStore(store, dir);
      return run;
    },

    listRuns(projectId: string): Run[] {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      return sortByUpdatedDesc(project.runs || []);
    },

    getRun(projectId: string, runId: string): Run | null {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      return (project.runs || []).find((run) => run.id === runId) || null;
    },

    appendRunEvent(
      projectId: string,
      runId: string,
      eventType: string,
      payload: Record<string, unknown> = {}
    ): RunEvent {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      const run = (project.runs || []).find((item) => item.id === runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      const event: RunEvent = {
        id: randomUUID(),
        type: String(eventType || "event"),
        payload,
        timestamp: now(),
      };
      run.events = Array.isArray(run.events) ? run.events : [];
      run.events.push(event);
      run.updatedAt = now();
      touchProject(project);
      saveStore(store, dir);
      return event;
    },

    updateRun(
      projectId: string,
      runId: string,
      updates: { status?: string; output?: string } = {}
    ): Run {
      const store = loadStore(dir);
      const project = findProjectOrThrow(store, projectId);
      const run = (project.runs || []).find((item) => item.id === runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      if (typeof updates.status === "string") run.status = updates.status;
      if (typeof updates.output === "string") run.output = updates.output;
      run.updatedAt = now();
      touchProject(project);
      saveStore(store, dir);
      return run;
    },

    queryDocuments(
      projectId: string,
      query: string,
      options: { limit?: number; collectionId?: string } = {}
    ): RagQueryResult {
      const limit = Math.min(20, Math.max(1, Number(options.limit || 8)));
      const docs = this.listDocuments(projectId, options.collectionId);
      const variants = buildQueryVariants(query);
      const stats = buildDocStats(docs);
      const aggregated = new Map<
        string,
        { doc: Document; score: number; snippetTokens: string[] }
      >();

      for (const variant of variants) {
        const queryTokens = tokenizeQuery(variant);
        for (const entry of stats.tokenizedDocs) {
          const score = scoreDocument(
            variant,
            queryTokens,
            entry,
            stats.df,
            docs.length
          );
          if (score <= 0) continue;
          const existing = aggregated.get(entry.doc.id) || {
            doc: entry.doc,
            score: 0,
            snippetTokens: [],
          };
          existing.score = Math.max(existing.score, score);
          existing.snippetTokens = queryTokens;
          aggregated.set(entry.doc.id, existing);
        }
      }

      const scored: RagResult[] = Array.from(aggregated.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ doc, score, snippetTokens }) => ({
          id: doc.id,
          title: doc.title,
          sourceUri: doc.sourceUri,
          score: Number(score.toFixed(3)),
          snippet: extractSnippet(doc.content, snippetTokens),
          metadata: doc.metadata || {},
        }));

      return {
        query,
        queryVariants: variants,
        totalCandidates: docs.length,
        results: scored,
      };
    },
  };
}

// --- TF-IDF / RAG utilities ---

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
  const parts = raw
    .split(splitters)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) variants.add(part);
  if (parts.length > 1) variants.add(parts.join(" "));
  return Array.from(variants).slice(0, 6);
}

function tokenizeQuery(query: string): string[] {
  const base = tokenize(query)
    .map(normalizeToken)
    .filter((token) => token && !STOPWORDS.has(token));
  return Array.from(new Set(base)).slice(0, 32);
}

interface DocStats {
  df: Map<string, number>;
  tokenizedDocs: Array<{
    doc: Document;
    tokens: string[];
    text: string;
  }>;
}

function buildDocStats(docs: Document[]): DocStats {
  const df = new Map<string, number>();
  const tokenizedDocs = docs.map((doc) => {
    const tokens = tokenize(`${doc.title || ""} ${doc.content || ""}`)
      .map(normalizeToken)
      .filter(Boolean);
    const unique = new Set(tokens);
    for (const token of unique) {
      df.set(token, (df.get(token) || 0) + 1);
    }
    return {
      doc,
      tokens,
      text: `${doc.title || ""} ${doc.content || ""}`.toLowerCase(),
    };
  });
  return { df, tokenizedDocs };
}

function scoreDocument(
  query: string,
  queryTokens: string[],
  statsEntry: DocStats["tokenizedDocs"][number],
  df: Map<string, number>,
  docCount: number
): number {
  if (!queryTokens.length) return 0;
  const tf = new Map<string, number>();
  for (const token of statsEntry.tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  let score = 0;
  for (const token of queryTokens) {
    const termFreq = tf.get(token) || 0;
    if (!termFreq) continue;
    const docFreq = df.get(token) || 1;
    const idf = Math.log(1 + docCount / docFreq);
    score += termFreq * idf;
  }
  const loweredQuery = String(query || "").toLowerCase();
  if (loweredQuery && statsEntry.text.includes(loweredQuery)) {
    score += 3;
  }
  return score;
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
