import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, UNSAFE_withComponentProps, Outlet, Meta, Links, ScrollRestoration, Scripts } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { useCallback, useState, useEffect, useMemo, useRef, isValidElement, cloneElement } from "react";
import { create } from "zustand";
import { Settings, Shield, Key, Plug, Package, Database, X, Save, Trash2, AlertCircle, CheckCircle, ChevronRight, Sun, Moon, FolderKanban, ChevronLeft, Plus, Pencil, Sparkles, CheckCircle2, Loader2, Circle, Wrench, Link2, ExternalLink, File, Activity, FolderOpen, AlertTriangle, Check, Server, Cpu, Edit3, Clock, XCircle, Copy, FileText, ChevronDown, Terminal, HelpCircle, Send, ListTodo, Square, CheckSquare, FlaskConical, Upload, Search, RefreshCw, ArrowRight, ClipboardList } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders
    });
  }
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    let timeoutId = setTimeout(
      () => abort(),
      streamTimeout + 1e3
    );
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = void 0;
              callback();
            }
          });
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function Layout({
  children
}) {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "UTF-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      className: "bg-background text-text-primary antialiased",
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = UNSAFE_withComponentProps(function Root() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Layout,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
function applySessionUpdate(sessions, sessionId, updates) {
  const existingIndex = sessions.findIndex((session) => session.id === sessionId);
  if (existingIndex === -1) {
    if (isInsertableSessionUpdate(updates)) {
      const created = { ...updates, id: sessionId };
      return [created, ...sessions];
    }
    return sessions;
  }
  return sessions.map(
    (session) => session.id === sessionId ? { ...session, ...updates } : session
  );
}
function isInsertableSessionUpdate(updates) {
  return typeof updates.title === "string" && typeof updates.status === "string" && typeof updates.createdAt === "number" && typeof updates.updatedAt === "number";
}
const PROJECTS_STORAGE_KEY = "open-analyst.projects.state.v1";
function loadProjectState() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { projects: [], activeProjectId: null, sessionProjectMap: {}, sessionRunMap: {}, sessionPlanMap: {}, activeCollectionByProject: {} };
  }
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return { projects: [], activeProjectId: null, sessionProjectMap: {}, sessionRunMap: {}, sessionPlanMap: {}, activeCollectionByProject: {} };
    const parsed = JSON.parse(raw);
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      activeProjectId: typeof parsed.activeProjectId === "string" ? parsed.activeProjectId : null,
      sessionProjectMap: parsed.sessionProjectMap && typeof parsed.sessionProjectMap === "object" ? parsed.sessionProjectMap : {},
      sessionRunMap: parsed.sessionRunMap && typeof parsed.sessionRunMap === "object" ? parsed.sessionRunMap : {},
      sessionPlanMap: parsed.sessionPlanMap && typeof parsed.sessionPlanMap === "object" ? parsed.sessionPlanMap : {},
      activeCollectionByProject: parsed.activeCollectionByProject && typeof parsed.activeCollectionByProject === "object" ? parsed.activeCollectionByProject : {}
    };
  } catch {
    return { projects: [], activeProjectId: null, sessionProjectMap: {}, sessionRunMap: {}, sessionPlanMap: {}, activeCollectionByProject: {} };
  }
}
function persistProjectState(next) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
  }
}
const defaultSettings = {
  theme: "light",
  defaultTools: [
    "askuserquestion",
    "todowrite",
    "todoread",
    "webfetch",
    "websearch",
    "read",
    "write",
    "edit",
    "list_directory",
    "glob",
    "grep"
  ],
  permissionRules: [
    { tool: "read", action: "allow" },
    { tool: "glob", action: "allow" },
    { tool: "grep", action: "allow" },
    { tool: "write", action: "ask" },
    { tool: "edit", action: "ask" },
    { tool: "bash", action: "ask" }
  ],
  globalSkillsPath: "",
  memoryStrategy: "auto",
  maxContextTokens: 18e4
};
const initialProjectState = loadProjectState();
const useAppStore = create((set) => ({
  // Initial state
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  partialMessagesBySession: {},
  pendingTurnsBySession: {},
  activeTurnsBySession: {},
  traceStepsBySession: {},
  isLoading: false,
  sidebarCollapsed: false,
  contextPanelCollapsed: false,
  pendingPermission: null,
  pendingQuestion: null,
  settings: defaultSettings,
  appConfig: null,
  isConfigured: false,
  showConfigModal: false,
  workingDir: null,
  projects: initialProjectState.projects,
  activeProjectId: initialProjectState.activeProjectId,
  sessionProjectMap: initialProjectState.sessionProjectMap,
  sessionRunMap: initialProjectState.sessionRunMap,
  sessionPlanMap: initialProjectState.sessionPlanMap,
  activeCollectionByProject: initialProjectState.activeCollectionByProject,
  sandboxSetupProgress: null,
  isSandboxSetupComplete: false,
  sandboxSyncStatus: null,
  // Session actions
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions],
    messagesBySession: { ...state.messagesBySession, [session.id]: [] },
    partialMessagesBySession: { ...state.partialMessagesBySession, [session.id]: "" },
    pendingTurnsBySession: { ...state.pendingTurnsBySession, [session.id]: [] },
    activeTurnsBySession: { ...state.activeTurnsBySession, [session.id]: null },
    traceStepsBySession: { ...state.traceStepsBySession, [session.id]: [] }
  })),
  updateSession: (sessionId, updates) => set((state) => ({
    sessions: applySessionUpdate(state.sessions, sessionId, updates)
  })),
  removeSession: (sessionId) => set((state) => {
    const { [sessionId]: _, ...restMessages } = state.messagesBySession;
    const { [sessionId]: __partials, ...restPartials } = state.partialMessagesBySession;
    const { [sessionId]: __pending, ...restPendingTurns } = state.pendingTurnsBySession;
    const { [sessionId]: __active, ...restActiveTurns } = state.activeTurnsBySession;
    const { [sessionId]: __traces, ...restTraces } = state.traceStepsBySession;
    const { [sessionId]: __sessionProject, ...restSessionProjectMap } = state.sessionProjectMap;
    const { [sessionId]: __sessionRun, ...restSessionRunMap } = state.sessionRunMap;
    const { [sessionId]: __sessionPlan, ...restSessionPlanMap } = state.sessionPlanMap;
    persistProjectState({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      sessionProjectMap: restSessionProjectMap,
      sessionRunMap: restSessionRunMap,
      sessionPlanMap: restSessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return {
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      messagesBySession: restMessages,
      partialMessagesBySession: restPartials,
      pendingTurnsBySession: restPendingTurns,
      activeTurnsBySession: restActiveTurns,
      traceStepsBySession: restTraces,
      sessionProjectMap: restSessionProjectMap,
      sessionRunMap: restSessionRunMap,
      sessionPlanMap: restSessionPlanMap,
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
    };
  }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  // Message actions
  addMessage: (sessionId, message) => set((state) => {
    const messages = state.messagesBySession[sessionId] || [];
    let updatedMessages = messages;
    let updatedPendingTurns = state.pendingTurnsBySession;
    if (message.role === "user") {
      updatedMessages = [...messages, message];
      const pending = [...state.pendingTurnsBySession[sessionId] || [], message.id];
      updatedPendingTurns = {
        ...state.pendingTurnsBySession,
        [sessionId]: pending
      };
    } else {
      const activeTurn = state.activeTurnsBySession[sessionId];
      if (activeTurn?.userMessageId) {
        const anchorIndex = messages.findIndex((item) => item.id === activeTurn.userMessageId);
        if (anchorIndex >= 0) {
          let insertIndex = anchorIndex + 1;
          while (insertIndex < messages.length) {
            if (messages[insertIndex].role === "user") break;
            insertIndex += 1;
          }
          updatedMessages = [
            ...messages.slice(0, insertIndex),
            message,
            ...messages.slice(insertIndex)
          ];
        } else {
          updatedMessages = [...messages, message];
        }
      } else {
        updatedMessages = [...messages, message];
      }
    }
    const shouldClearPartial = message.role === "assistant";
    return {
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: updatedMessages
      },
      pendingTurnsBySession: updatedPendingTurns,
      partialMessagesBySession: shouldClearPartial ? {
        ...state.partialMessagesBySession,
        [sessionId]: ""
      } : state.partialMessagesBySession
    };
  }),
  setMessages: (sessionId, messages) => set((state) => ({
    messagesBySession: {
      ...state.messagesBySession,
      [sessionId]: messages
    }
  })),
  setPartialMessage: (sessionId, partial) => set((state) => ({
    partialMessagesBySession: {
      ...state.partialMessagesBySession,
      [sessionId]: (state.partialMessagesBySession[sessionId] || "") + partial
    }
  })),
  clearPartialMessage: (sessionId) => set((state) => ({
    partialMessagesBySession: {
      ...state.partialMessagesBySession,
      [sessionId]: ""
    }
  })),
  activateNextTurn: (sessionId, stepId) => set((state) => {
    const pending = state.pendingTurnsBySession[sessionId] || [];
    if (pending.length === 0) {
      return {
        activeTurnsBySession: {
          ...state.activeTurnsBySession,
          [sessionId]: null
        }
      };
    }
    const [nextMessageId, ...rest] = pending;
    const messages = state.messagesBySession[sessionId] || [];
    const updatedMessages = messages.map(
      (message) => message.id === nextMessageId ? { ...message, localStatus: void 0 } : message
    );
    return {
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: updatedMessages
      },
      pendingTurnsBySession: {
        ...state.pendingTurnsBySession,
        [sessionId]: rest
      },
      activeTurnsBySession: {
        ...state.activeTurnsBySession,
        [sessionId]: { stepId, userMessageId: nextMessageId }
      }
    };
  }),
  updateActiveTurnStep: (sessionId, stepId) => set((state) => {
    const activeTurn = state.activeTurnsBySession[sessionId];
    if (!activeTurn || activeTurn.stepId === stepId) return {};
    return {
      activeTurnsBySession: {
        ...state.activeTurnsBySession,
        [sessionId]: { ...activeTurn, stepId }
      }
    };
  }),
  clearActiveTurn: (sessionId, stepId) => set((state) => {
    const activeTurn = state.activeTurnsBySession[sessionId];
    if (!activeTurn) return {};
    if (stepId && activeTurn.stepId !== stepId) return {};
    return {
      activeTurnsBySession: {
        ...state.activeTurnsBySession,
        [sessionId]: null
      }
    };
  }),
  clearPendingTurns: (sessionId) => set((state) => ({
    pendingTurnsBySession: {
      ...state.pendingTurnsBySession,
      [sessionId]: []
    }
  })),
  clearQueuedMessages: (sessionId) => set((state) => {
    const messages = state.messagesBySession[sessionId] || [];
    let hasQueued = false;
    const updatedMessages = messages.map((message) => {
      if (message.localStatus === "queued") {
        hasQueued = true;
        return { ...message, localStatus: void 0 };
      }
      return message;
    });
    if (!hasQueued) return {};
    return {
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: updatedMessages
      }
    };
  }),
  cancelQueuedMessages: (sessionId) => set((state) => {
    const messages = state.messagesBySession[sessionId] || [];
    let hasQueued = false;
    const updatedMessages = messages.map((message) => {
      if (message.localStatus === "queued") {
        hasQueued = true;
        return { ...message, localStatus: "cancelled" };
      }
      return message;
    });
    if (!hasQueued) return {};
    return {
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: updatedMessages
      }
    };
  }),
  // Trace actions
  addTraceStep: (sessionId, step) => set((state) => ({
    traceStepsBySession: {
      ...state.traceStepsBySession,
      [sessionId]: [...state.traceStepsBySession[sessionId] || [], step]
    }
  })),
  updateTraceStep: (sessionId, stepId, updates) => set((state) => ({
    traceStepsBySession: {
      ...state.traceStepsBySession,
      [sessionId]: (state.traceStepsBySession[sessionId] || []).map(
        (step) => step.id === stepId ? { ...step, ...updates } : step
      )
    }
  })),
  setTraceSteps: (sessionId, steps) => set((state) => ({
    traceStepsBySession: {
      ...state.traceStepsBySession,
      [sessionId]: steps
    }
  })),
  // UI actions
  setLoading: (loading) => set({ isLoading: loading }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleContextPanel: () => set((state) => ({ contextPanelCollapsed: !state.contextPanelCollapsed })),
  // Permission actions
  setPendingPermission: (permission2) => set({ pendingPermission: permission2 }),
  // Question actions (AskUserQuestion)
  setPendingQuestion: (question) => set({ pendingQuestion: question }),
  // Settings actions
  updateSettings: (updates) => set((state) => ({
    settings: { ...state.settings, ...updates }
  })),
  // Config actions
  setAppConfig: (config) => set({ appConfig: config }),
  setIsConfigured: (configured) => set({ isConfigured: configured }),
  setShowConfigModal: (show) => set({ showConfigModal: show }),
  // Working directory actions
  setWorkingDir: (path2) => set({ workingDir: path2 }),
  setProjects: (projects) => set((state) => {
    const nextActive = state.activeProjectId && projects.some((project) => project.id === state.activeProjectId) ? state.activeProjectId : projects[0]?.id || null;
    persistProjectState({
      projects,
      activeProjectId: nextActive,
      sessionProjectMap: state.sessionProjectMap,
      sessionRunMap: state.sessionRunMap,
      sessionPlanMap: state.sessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return { projects, activeProjectId: nextActive };
  }),
  upsertProject: (project) => set((state) => {
    const exists = state.projects.some((item) => item.id === project.id);
    const projects = exists ? state.projects.map((item) => item.id === project.id ? { ...item, ...project } : item) : [project, ...state.projects];
    const activeProjectId = state.activeProjectId || project.id;
    persistProjectState({
      projects,
      activeProjectId,
      sessionProjectMap: state.sessionProjectMap,
      sessionRunMap: state.sessionRunMap,
      sessionPlanMap: state.sessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return { projects, activeProjectId };
  }),
  removeProject: (projectId) => set((state) => {
    const projects = state.projects.filter((project) => project.id !== projectId);
    const activeProjectId = state.activeProjectId === projectId ? projects[0]?.id || null : state.activeProjectId;
    persistProjectState({
      projects,
      activeProjectId,
      sessionProjectMap: state.sessionProjectMap,
      sessionRunMap: state.sessionRunMap,
      sessionPlanMap: state.sessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return { projects, activeProjectId };
  }),
  setActiveProjectId: (projectId) => set((state) => {
    persistProjectState({
      projects: state.projects,
      activeProjectId: projectId,
      sessionProjectMap: state.sessionProjectMap,
      sessionRunMap: state.sessionRunMap,
      sessionPlanMap: state.sessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return { activeProjectId: projectId };
  }),
  linkSessionToProject: (sessionId, projectId) => set((state) => {
    const sessionProjectMap = {
      ...state.sessionProjectMap,
      [sessionId]: projectId
    };
    persistProjectState({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      sessionProjectMap,
      sessionRunMap: state.sessionRunMap,
      sessionPlanMap: state.sessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return { sessionProjectMap };
  }),
  linkSessionToRun: (sessionId, runId) => set((state) => {
    const sessionRunMap = {
      ...state.sessionRunMap,
      [sessionId]: runId
    };
    persistProjectState({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      sessionProjectMap: state.sessionProjectMap,
      sessionRunMap,
      sessionPlanMap: state.sessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return { sessionRunMap };
  }),
  setSessionPlanSnapshot: (sessionId, snapshot) => set((state) => {
    const sessionPlanMap = {
      ...state.sessionPlanMap,
      [sessionId]: snapshot
    };
    persistProjectState({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      sessionProjectMap: state.sessionProjectMap,
      sessionRunMap: state.sessionRunMap,
      sessionPlanMap,
      activeCollectionByProject: state.activeCollectionByProject
    });
    return { sessionPlanMap };
  }),
  setProjectActiveCollection: (projectId, collectionId) => set((state) => {
    const activeCollectionByProject = {
      ...state.activeCollectionByProject,
      [projectId]: collectionId
    };
    persistProjectState({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      sessionProjectMap: state.sessionProjectMap,
      sessionRunMap: state.sessionRunMap,
      sessionPlanMap: state.sessionPlanMap,
      activeCollectionByProject
    });
    return { activeCollectionByProject };
  }),
  // Sandbox setup actions
  setSandboxSetupProgress: (progress) => set({ sandboxSetupProgress: progress }),
  setSandboxSetupComplete: (complete) => set({ isSandboxSetupComplete: complete }),
  // Sandbox sync actions
  setSandboxSyncStatus: (status) => set({ sandboxSyncStatus: status })
}));
function getHeadlessApiBase() {
  return "";
}
async function requestJson(path2, init) {
  const res = await fetch(`${getHeadlessApiBase()}/api${path2}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers || {}
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body && (body.error || body.message) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body;
}
async function headlessSaveConfig(config) {
  await requestJson("/config", {
    method: "POST",
    body: JSON.stringify(config)
  });
}
async function headlessSetWorkingDir(path2) {
  return requestJson("/workdir", {
    method: "POST",
    body: JSON.stringify({ path: path2 })
  });
}
async function headlessGetWorkingDir() {
  return requestJson("/workdir");
}
async function headlessChat(messages, prompt, projectId, options) {
  const result = await requestJson("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages,
      prompt,
      projectId,
      collectionId: options?.collectionId,
      collectionName: options?.collectionName,
      deepResearch: Boolean(options?.deepResearch)
    })
  });
  return {
    text: result.text || "",
    traces: Array.isArray(result.traces) ? result.traces : [],
    runId: result.runId,
    projectId: result.projectId
  };
}
async function headlessGetTools() {
  const result = await requestJson("/tools");
  return Array.isArray(result.tools) ? result.tools : [];
}
async function headlessGetProjects() {
  const response = await requestJson("/projects");
  return {
    activeProject: response.activeProject || null,
    projects: Array.isArray(response.projects) ? response.projects : []
  };
}
async function headlessCreateProject(name, description = "") {
  const response = await requestJson("/projects", {
    method: "POST",
    body: JSON.stringify({ name, description })
  });
  return response.project;
}
async function headlessSetActiveProject(projectId) {
  await requestJson("/projects/active", {
    method: "POST",
    body: JSON.stringify({ projectId })
  });
}
async function headlessUpdateProject(projectId, updates) {
  const response = await requestJson(`/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates)
  });
  return response.project;
}
async function headlessDeleteProject(projectId) {
  await requestJson(`/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE"
  });
}
async function headlessGetCollections(projectId) {
  const response = await requestJson(`/projects/${encodeURIComponent(projectId)}/collections`);
  return Array.isArray(response.collections) ? response.collections : [];
}
async function headlessCreateCollection(projectId, name, description = "") {
  const response = await requestJson(`/projects/${encodeURIComponent(projectId)}/collections`, {
    method: "POST",
    body: JSON.stringify({ name, description })
  });
  return response.collection;
}
async function headlessGetDocuments(projectId, collectionId) {
  const query = "";
  const response = await requestJson(
    `/projects/${encodeURIComponent(projectId)}/documents${query}`
  );
  return Array.isArray(response.documents) ? response.documents : [];
}
async function headlessCreateDocument(projectId, input) {
  const response = await requestJson(`/projects/${encodeURIComponent(projectId)}/documents`, {
    method: "POST",
    body: JSON.stringify({
      collectionId: input.collectionId,
      title: input.title,
      content: input.content,
      sourceType: input.sourceType || "manual",
      sourceUri: input.sourceUri || `manual://${input.title.toLowerCase().replace(/\s+/g, "-")}`,
      metadata: input.metadata || {}
    })
  });
  return response.document;
}
async function headlessImportUrl(projectId, url, collectionId) {
  const response = await requestJson(
    `/projects/${encodeURIComponent(projectId)}/import/url`,
    {
      method: "POST",
      body: JSON.stringify({ url, collectionId })
    }
  );
  return response.document;
}
async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
async function headlessImportFile(projectId, file, collectionId) {
  const contentBase64 = await fileToBase64(file);
  const response = await requestJson(
    `/projects/${encodeURIComponent(projectId)}/import/file`,
    {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64,
        collectionId
      })
    }
  );
  return response.document;
}
async function headlessRagQuery(projectId, query, collectionId, limit = 8) {
  const response = await requestJson(`/projects/${encodeURIComponent(projectId)}/rag/query`, {
    method: "POST",
    body: JSON.stringify({ query, collectionId, limit })
  });
  return {
    query: response.query || query,
    totalCandidates: Number(response.totalCandidates || 0),
    results: Array.isArray(response.results) ? response.results : []
  };
}
async function headlessGetRuns(projectId) {
  const response = await requestJson(`/projects/${encodeURIComponent(projectId)}/runs`);
  return Array.isArray(response.runs) ? response.runs : [];
}
async function headlessGetRun(projectId, runId) {
  try {
    const response = await requestJson(
      `/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}`
    );
    return response.run || null;
  } catch {
    return null;
  }
}
async function headlessGetCredentials() {
  const response = await requestJson("/credentials");
  return Array.isArray(response.credentials) ? response.credentials : [];
}
async function headlessSaveCredential(input) {
  const response = await requestJson("/credentials", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.credential;
}
async function headlessUpdateCredential(credentialId, input) {
  const response = await requestJson(`/credentials/${encodeURIComponent(credentialId)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return response.credential;
}
async function headlessDeleteCredential(credentialId) {
  await requestJson(`/credentials/${encodeURIComponent(credentialId)}`, {
    method: "DELETE"
  });
}
async function headlessGetMcpPresets() {
  const response = await requestJson("/mcp/presets");
  return response.presets && typeof response.presets === "object" ? response.presets : {};
}
async function headlessGetMcpServers() {
  const response = await requestJson("/mcp/servers");
  return Array.isArray(response.servers) ? response.servers : [];
}
async function headlessSaveMcpServer(server) {
  const response = await requestJson("/mcp/servers", {
    method: "POST",
    body: JSON.stringify(server)
  });
  return response.server;
}
async function headlessDeleteMcpServer(serverId) {
  await requestJson(`/mcp/servers/${encodeURIComponent(serverId)}`, {
    method: "DELETE"
  });
}
async function headlessGetMcpServerStatus() {
  const response = await requestJson("/mcp/status");
  return Array.isArray(response.statuses) ? response.statuses : [];
}
async function headlessGetMcpTools() {
  const response = await requestJson("/mcp/tools");
  return Array.isArray(response.tools) ? response.tools : [];
}
async function headlessGetSkills() {
  const response = await requestJson("/skills");
  return Array.isArray(response.skills) ? response.skills : [];
}
async function headlessValidateSkillPath(folderPath) {
  return requestJson("/skills/validate", {
    method: "POST",
    body: JSON.stringify({ folderPath })
  });
}
async function headlessInstallSkill(folderPath) {
  return requestJson("/skills/install", {
    method: "POST",
    body: JSON.stringify({ folderPath })
  });
}
async function headlessDeleteSkill(skillId) {
  await requestJson(`/skills/${encodeURIComponent(skillId)}`, {
    method: "DELETE"
  });
}
async function headlessSetSkillEnabled(skillId, enabled) {
  await requestJson(`/skills/${encodeURIComponent(skillId)}/enabled`, {
    method: "POST",
    body: JSON.stringify({ enabled })
  });
}
async function headlessGetLogs() {
  const response = await requestJson("/logs");
  return {
    files: Array.isArray(response.files) ? response.files : [],
    directory: String(response.directory || "")
  };
}
async function headlessLogsIsEnabled() {
  const response = await requestJson("/logs/enabled");
  return Boolean(response.enabled);
}
async function headlessLogsSetEnabled(enabled) {
  await requestJson("/logs/enabled", {
    method: "POST",
    body: JSON.stringify({ enabled })
  });
}
async function headlessLogsExport() {
  return requestJson("/logs/export", { method: "POST" });
}
async function headlessLogsClear() {
  return requestJson("/logs/clear", { method: "POST" });
}
function contentBlocksToText(content) {
  return content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
}
function messageToBrowserChatMessage(message) {
  if (message.role !== "user" && message.role !== "assistant" && message.role !== "system") {
    return null;
  }
  const content = contentBlocksToText(message.content);
  if (!content) return null;
  return { role: message.role, content };
}
function useIPC() {
  const {
    addSession,
    updateSession,
    addMessage,
    setLoading,
    setPendingPermission,
    setPendingQuestion,
    clearActiveTurn,
    activateNextTurn,
    clearPendingTurns,
    cancelQueuedMessages,
    addTraceStep,
    activeProjectId,
    sessionProjectMap,
    linkSessionToProject,
    linkSessionToRun,
    setActiveProjectId
  } = useAppStore();
  const applyHeadlessTraces = useCallback((sessionId, traces) => {
    traces.forEach((trace) => {
      addTraceStep(sessionId, {
        id: trace.id || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: trace.type,
        status: trace.status,
        title: trace.title || trace.toolName || "Tool",
        toolName: trace.toolName,
        toolInput: trace.toolInput,
        toolOutput: trace.toolOutput,
        timestamp: Date.now()
      });
    });
  }, [addTraceStep]);
  const startSession = useCallback(
    async (title, promptOrContent, cwd, options) => {
      setLoading(true);
      let sessionId = "";
      let mockStepId = "";
      const content = typeof promptOrContent === "string" ? [{ type: "text", text: promptOrContent }] : promptOrContent;
      const textContent = content.find((block) => block.type === "text");
      const prompt = textContent && "text" in textContent ? textContent.text : "";
      try {
        sessionId = `session-${Date.now()}`;
        const session = {
          id: sessionId,
          title: title || "New Session",
          status: "running",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          cwd: cwd || "",
          mountedPaths: [],
          allowedTools: [
            "askuserquestion",
            "todowrite",
            "todoread",
            "webfetch",
            "websearch",
            "read",
            "write",
            "edit",
            "list_directory",
            "glob",
            "grep"
          ],
          memoryEnabled: false
        };
        addSession(session);
        if (activeProjectId) {
          linkSessionToProject(sessionId, activeProjectId);
        }
        useAppStore.getState().setActiveSession(sessionId);
        const userMessage = {
          id: `msg-user-${Date.now()}`,
          sessionId,
          role: "user",
          content,
          timestamp: Date.now()
        };
        addMessage(sessionId, userMessage);
        mockStepId = `mock-step-${Date.now()}`;
        activateNextTurn(sessionId, mockStepId);
        updateSession(sessionId, { status: "running" });
        const messages = useAppStore.getState().messagesBySession[sessionId] || [];
        const chatMessages = messages.map(messageToBrowserChatMessage).filter((item) => item !== null);
        const projectId = activeProjectId || void 0;
        let selectedCollectionId;
        if (projectId) {
          const collections = await headlessGetCollections(projectId);
          const selectedId = useAppStore.getState().activeCollectionByProject?.[projectId] || "";
          selectedCollectionId = collections.some((c) => c.id === selectedId) ? selectedId : collections[0]?.id;
        }
        const result = await headlessChat(chatMessages, prompt, projectId, {
          collectionId: selectedCollectionId,
          deepResearch: Boolean(options?.deepResearch)
        });
        if (result.runId) {
          linkSessionToRun(sessionId, result.runId);
        }
        if (result.traces.length > 0) {
          applyHeadlessTraces(sessionId, result.traces);
        }
        addMessage(sessionId, {
          id: `msg-assistant-${Date.now()}`,
          sessionId,
          role: "assistant",
          content: [{ type: "text", text: result.text || "" }],
          timestamp: Date.now()
        });
        updateSession(sessionId, { status: "idle" });
        clearActiveTurn(sessionId, mockStepId);
        clearPendingTurns(sessionId);
        setLoading(false);
        return session;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (sessionId) {
          addMessage(sessionId, {
            id: `msg-assistant-${Date.now()}`,
            sessionId,
            role: "assistant",
            content: [{ type: "text", text: `Error: ${message}` }],
            timestamp: Date.now()
          });
          updateSession(sessionId, { status: "error" });
          clearActiveTurn(sessionId, mockStepId || void 0);
          clearPendingTurns(sessionId);
        }
        setLoading(false);
        throw e;
      }
    },
    [
      activeProjectId,
      addMessage,
      addSession,
      activateNextTurn,
      applyHeadlessTraces,
      clearActiveTurn,
      clearPendingTurns,
      linkSessionToProject,
      linkSessionToRun,
      setLoading,
      updateSession
      // options is call-site argument; hook deps unaffected
    ]
  );
  const continueSession = useCallback(
    async (sessionId, promptOrContent, options) => {
      setLoading(true);
      const content = typeof promptOrContent === "string" ? [{ type: "text", text: promptOrContent }] : promptOrContent;
      const textContent = content.find((block) => block.type === "text");
      const prompt = textContent && "text" in textContent ? textContent.text : "";
      const store = useAppStore.getState();
      const isSessionRunning = store.sessions.find((session) => session.id === sessionId)?.status === "running";
      const hasActiveTurn = Boolean(store.activeTurnsBySession[sessionId]);
      const hasPending = (store.pendingTurnsBySession[sessionId]?.length ?? 0) > 0;
      const shouldQueue = isSessionRunning || hasActiveTurn || hasPending;
      addMessage(sessionId, {
        id: `msg-user-${Date.now()}`,
        sessionId,
        role: "user",
        content,
        timestamp: Date.now(),
        localStatus: shouldQueue ? "queued" : void 0
      });
      let mockStepId = "";
      try {
        updateSession(sessionId, { status: "running" });
        mockStepId = `mock-step-${Date.now()}`;
        activateNextTurn(sessionId, mockStepId);
        const messages = useAppStore.getState().messagesBySession[sessionId] || [];
        const chatMessages = messages.map(messageToBrowserChatMessage).filter((item) => item !== null);
        const projectId = sessionProjectMap[sessionId] || activeProjectId || void 0;
        let selectedCollectionId;
        if (projectId) {
          const collections = await headlessGetCollections(projectId);
          const selectedId = useAppStore.getState().activeCollectionByProject?.[projectId] || "";
          selectedCollectionId = collections.some((c) => c.id === selectedId) ? selectedId : collections[0]?.id;
        }
        const result = await headlessChat(chatMessages, prompt, projectId, {
          collectionId: selectedCollectionId,
          deepResearch: Boolean(options?.deepResearch)
        });
        if (result.runId) {
          linkSessionToRun(sessionId, result.runId);
        }
        if (result.traces.length > 0) {
          applyHeadlessTraces(sessionId, result.traces);
        }
        addMessage(sessionId, {
          id: `msg-assistant-${Date.now()}`,
          sessionId,
          role: "assistant",
          content: [{ type: "text", text: result.text || "" }],
          timestamp: Date.now()
        });
        updateSession(sessionId, { status: "idle" });
        clearActiveTurn(sessionId, mockStepId);
        clearPendingTurns(sessionId);
        setLoading(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        addMessage(sessionId, {
          id: `msg-assistant-${Date.now()}`,
          sessionId,
          role: "assistant",
          content: [{ type: "text", text: `Error: ${message}` }],
          timestamp: Date.now()
        });
        updateSession(sessionId, { status: "error" });
        clearActiveTurn(sessionId, mockStepId || void 0);
        clearPendingTurns(sessionId);
        setLoading(false);
        throw e;
      }
    },
    [
      activeProjectId,
      addMessage,
      activateNextTurn,
      applyHeadlessTraces,
      clearActiveTurn,
      clearPendingTurns,
      linkSessionToRun,
      sessionProjectMap,
      setLoading,
      updateSession
    ]
  );
  const stopSession = useCallback(
    (sessionId) => {
      cancelQueuedMessages(sessionId);
      clearPendingTurns(sessionId);
      clearActiveTurn(sessionId);
      updateSession(sessionId, { status: "idle" });
      setLoading(false);
    },
    [cancelQueuedMessages, clearActiveTurn, clearPendingTurns, setLoading, updateSession]
  );
  const deleteSession = useCallback((sessionId) => {
    useAppStore.getState().removeSession(sessionId);
  }, []);
  const listSessions = useCallback(() => {
  }, []);
  const getSessionMessages = useCallback(async (_sessionId) => {
    return [];
  }, []);
  const getSessionTraceSteps = useCallback(async (_sessionId) => {
    return [];
  }, []);
  const respondToPermission = useCallback((_toolUseId, _result) => {
    setPendingPermission(null);
  }, [setPendingPermission]);
  const respondToQuestion = useCallback((_questionId, _answer) => {
    setPendingQuestion(null);
  }, [setPendingQuestion]);
  const selectFolder = useCallback(async () => {
    const value = window.prompt("Enter working directory path (local path or s3:// URI):");
    return value?.trim() || null;
  }, []);
  const getWorkingDir = useCallback(async () => {
    try {
      const result = await headlessGetWorkingDir();
      return result.workingDir || null;
    } catch {
      return null;
    }
  }, []);
  const changeWorkingDir = useCallback(async () => {
    const path2 = window.prompt("Enter working directory path (local path or s3:// URI):");
    if (!path2?.trim()) {
      return { success: false, path: "", error: "User cancelled" };
    }
    try {
      const result = await headlessSetWorkingDir(path2.trim());
      return { success: true, path: result.path };
    } catch (error) {
      return {
        success: false,
        path: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }, []);
  const setWorkingDirPath = useCallback(async (path2) => {
    try {
      const result = await headlessSetWorkingDir(path2);
      return { success: true, path: result.path };
    } catch (error) {
      return {
        success: false,
        path: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }, []);
  const getMCPServers = useCallback(async () => {
    return [];
  }, []);
  const refreshProjects = useCallback(async () => {
    try {
      const payload = await headlessGetProjects();
      setActiveProjectId(payload.activeProject?.id || null);
      return payload;
    } catch {
      return { activeProject: null, projects: [] };
    }
  }, [setActiveProjectId]);
  const getHeadlessTools = useCallback(async () => {
    try {
      return await headlessGetTools();
    } catch {
      return [];
    }
  }, []);
  return {
    send: () => {
    },
    invoke: async () => null,
    startSession,
    continueSession,
    stopSession,
    deleteSession,
    listSessions,
    getSessionMessages,
    getSessionTraceSteps,
    respondToPermission,
    respondToQuestion,
    selectFolder,
    getWorkingDir,
    changeWorkingDir,
    setWorkingDirPath,
    getMCPServers,
    getHeadlessTools,
    refreshProjects
  };
}
const FALLBACK_PRESETS = {
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    models: [
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
      { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5" },
      { id: "openai/gpt-4o", name: "GPT-4o" }
    ],
    keyPlaceholder: "sk-or-v1-...",
    keyHint: "Get key from openrouter.ai/keys"
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    models: [
      { id: "claude-sonnet-4-5", name: "claude-sonnet-4-5" },
      { id: "claude-opus-4-5", name: "claude-opus-4-5" },
      { id: "claude-haiku-4-5", name: "claude-haiku-4-5" }
    ],
    keyPlaceholder: "sk-ant-...",
    keyHint: "Get key from console.anthropic.com"
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-5.2", name: "gpt-5.2" },
      { id: "gpt-5.2-codex", name: "gpt-5.2-codex" },
      { id: "gpt-5.2-mini", name: "gpt-5.2-mini" }
    ],
    keyPlaceholder: "sk-...",
    keyHint: "Get key from platform.openai.com"
  },
  bedrock: {
    name: "Amazon Bedrock",
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
    models: [
      { id: "openai.gpt-oss-120b-1:0", name: "openai.gpt-oss-120b-1:0" },
      { id: "openai.gpt-oss-20b-1:0", name: "openai.gpt-oss-20b-1:0" },
      { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", name: "anthropic.claude-3-5-sonnet-20241022-v2:0" }
    ],
    keyPlaceholder: "bedrock_api_key",
    keyHint: "Create API key in Bedrock console and set your AWS region endpoint"
  },
  custom: {
    name: "Custom Endpoint",
    baseUrl: "https://api.anthropic.com",
    models: [
      { id: "claude-sonnet-4-5", name: "claude-sonnet-4-5" },
      { id: "gpt-4o", name: "gpt-4o" },
      { id: "gpt-4o-mini", name: "gpt-4o-mini" }
    ],
    keyPlaceholder: "sk-xxx",
    keyHint: "Enter your API key"
  }
};
const STORAGE_KEY = "open-analyst.browser.config.v1";
const defaultBrowserConfig = {
  provider: "openrouter",
  apiKey: "",
  baseUrl: FALLBACK_PRESETS.openrouter.baseUrl,
  customProtocol: "anthropic",
  bedrockRegion: "us-east-1",
  model: FALLBACK_PRESETS.openrouter.models[0].id,
  openaiMode: "responses",
  enableThinking: false,
  sandboxEnabled: false,
  isConfigured: false
};
function normalizeConfig$1(config) {
  const provider = config.provider || defaultBrowserConfig.provider;
  const inferredRegion = extractBedrockRegionFromUrl(config.baseUrl || "");
  const region = (config.bedrockRegion || "").trim().toLowerCase() || inferredRegion || (provider === "bedrock" ? "us-east-1" : defaultBrowserConfig.bedrockRegion || "us-east-1");
  const providerBaseUrl = FALLBACK_PRESETS[provider]?.baseUrl || "";
  const bedrockBaseUrl = `https://bedrock-mantle.${region}.api.aws/v1`;
  const baseUrl = provider === "custom" ? config.baseUrl || "" : provider === "bedrock" ? normalizeBedrockBaseUrl(config.baseUrl || bedrockBaseUrl, region) : providerBaseUrl;
  return {
    ...config,
    baseUrl,
    bedrockRegion: region,
    openaiMode: "responses",
    isConfigured: Boolean(config.apiKey?.trim()) && Boolean(config.isConfigured)
  };
}
function getBrowserConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultBrowserConfig;
    }
    const parsed = JSON.parse(raw);
    const merged = {
      ...defaultBrowserConfig,
      ...parsed,
      apiKey: parsed.apiKey || "",
      model: parsed.model || defaultBrowserConfig.model,
      provider: parsed.provider || defaultBrowserConfig.provider
    };
    if (merged.provider !== "custom" && merged.provider !== "bedrock") {
      merged.baseUrl = FALLBACK_PRESETS[merged.provider].baseUrl;
    }
    if (!merged.apiKey) {
      merged.isConfigured = false;
    }
    return normalizeConfig$1(merged);
  } catch {
    return defaultBrowserConfig;
  }
}
function saveBrowserConfig(updates) {
  const current = getBrowserConfig();
  const merged = {
    ...current,
    ...updates,
    apiKey: updates.apiKey ?? current.apiKey,
    isConfigured: updates.isConfigured ?? Boolean((updates.apiKey ?? current.apiKey)?.trim())
  };
  const normalized = normalizeConfig$1(merged);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
function trimTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}
function normalizeBedrockBaseUrl(url, region) {
  const fallback = `https://bedrock-mantle.${region}.api.aws/v1`;
  const raw = String(url || "").trim();
  if (!raw) return fallback;
  const trimmed = trimTrailingSlash(raw);
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}
function extractBedrockRegionFromUrl(url) {
  const value = String(url || "").trim().toLowerCase();
  const runtimeMatch = value.match(/bedrock-runtime\.([a-z0-9-]+)\.amazonaws\.com/);
  if (runtimeMatch?.[1]) return runtimeMatch[1];
  const mantleMatch = value.match(/bedrock-mantle\.([a-z0-9-]+)\.api\.aws/);
  return mantleMatch?.[1] || null;
}
function classifyStatus(status) {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown";
}
async function testApiConnectionBrowser(input) {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    return { ok: false, errorType: "missing_key", details: "API key is required" };
  }
  const openAiProtocol = input.provider === "openai" || input.provider === "bedrock" || input.provider === "custom" && input.customProtocol === "openai";
  let baseUrl = input.baseUrl?.trim() || FALLBACK_PRESETS[input.provider].baseUrl;
  if (!baseUrl) {
    return {
      ok: false,
      errorType: "missing_base_url",
      details: "Base URL is required"
    };
  }
  baseUrl = input.provider === "bedrock" ? normalizeBedrockBaseUrl(baseUrl, extractBedrockRegionFromUrl(baseUrl) || "us-east-1") : trimTrailingSlash(baseUrl);
  let url;
  let headers;
  if (openAiProtocol) {
    url = `${baseUrl}/models`;
    headers = {
      Authorization: `Bearer ${apiKey}`
    };
  } else if (input.provider === "openrouter") {
    url = `${baseUrl}/v1/models`;
    headers = {
      Authorization: `Bearer ${apiKey}`
    };
  } else {
    url = `${baseUrl}/v1/models`;
    headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers
    });
    const latencyMs = Date.now() - start;
    if (response.ok) {
      return { ok: true, status: response.status, latencyMs };
    }
    let details = response.statusText || `HTTP ${response.status}`;
    try {
      const json = await response.json();
      details = json.error?.message || json.message || details;
    } catch {
    }
    return {
      ok: false,
      status: response.status,
      latencyMs,
      errorType: classifyStatus(response.status),
      details
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      errorType: "network_error",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
const TABS = [
  { id: "api", label: "API", description: "Provider, model, and key setup", icon: Settings },
  { id: "sandbox", label: "Sandbox", description: "Runtime isolation guidance", icon: Shield },
  { id: "credentials", label: "Credentials", description: "Project/service secrets", icon: Key },
  { id: "connectors", label: "MCP", description: "Connector servers and tools", icon: Plug },
  { id: "skills", label: "Skills", description: "Install and enable capabilities", icon: Package },
  { id: "logs", label: "Logs", description: "Service diagnostics and export", icon: Database }
];
function SettingsPanel({ isOpen, onClose, initialTab = "api" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [initialTab, isOpen]);
  if (!isOpen) return null;
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60", children: /* @__PURE__ */ jsxs("div", { className: "bg-surface rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[88vh] overflow-hidden border border-border flex", children: [
    /* @__PURE__ */ jsx("div", { className: "w-72 border-r border-border p-3 space-y-1", children: TABS.map((tab) => /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setActiveTab(tab.id),
        className: `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${activeTab === tab.id ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-surface-hover"}`,
        children: [
          /* @__PURE__ */ jsx(tab.icon, { className: "w-4 h-4" }),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium truncate", children: tab.label }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted truncate", children: tab.description })
          ] })
        ]
      },
      tab.id
    )) }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold", children: TABS.find((tab) => tab.id === activeTab)?.label }),
        /* @__PURE__ */ jsx("button", { onClick: onClose, className: "p-2 rounded hover:bg-surface-hover", children: /* @__PURE__ */ jsx(X, { className: "w-4 h-4" }) })
      ] }),
      activeTab === "api" && /* @__PURE__ */ jsx(APISettingsTab, {}),
      activeTab === "sandbox" && /* @__PURE__ */ jsx(SandboxTab, {}),
      activeTab === "credentials" && /* @__PURE__ */ jsx(CredentialsTab, {}),
      activeTab === "connectors" && /* @__PURE__ */ jsx(ConnectorsTab, {}),
      activeTab === "skills" && /* @__PURE__ */ jsx(SkillsTab, {}),
      activeTab === "logs" && /* @__PURE__ */ jsx(LogsTab, {})
    ] })
  ] }) });
}
function APISettingsTab() {
  const inferBedrockRegion2 = (url) => {
    const value = String(url || "").toLowerCase();
    const runtimeMatch = value.match(/bedrock-runtime\.([a-z0-9-]+)\.amazonaws\.com/);
    if (runtimeMatch?.[1]) return runtimeMatch[1];
    const mantleMatch = value.match(/bedrock-mantle\.([a-z0-9-]+)\.api\.aws/);
    return mantleMatch?.[1] || "us-east-1";
  };
  const setAppConfig = useAppStore((state) => state.setAppConfig);
  const setIsConfigured = useAppStore((state) => state.setIsConfigured);
  const [config, setConfig] = useState(() => getBrowserConfig());
  const [provider, setProvider] = useState(config.provider || "openrouter");
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || FALLBACK_PRESETS[config.provider || "openrouter"]?.baseUrl || "");
  const [model, setModel] = useState(config.model || "");
  const [customModel, setCustomModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [bedrockRegion, setBedrockRegion] = useState(config.bedrockRegion || inferBedrockRegion2(config.baseUrl));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testing, setTesting] = useState(false);
  const models = useMemo(() => FALLBACK_PRESETS[provider]?.models || [], [provider]);
  useEffect(() => {
    const preset = FALLBACK_PRESETS[provider];
    if (!preset) return;
    if (provider === "custom") {
      if (!baseUrl.trim()) setBaseUrl(preset.baseUrl);
    } else if (provider === "bedrock") {
      const region = bedrockRegion.trim().toLowerCase() || "us-east-1";
      setBaseUrl(`https://bedrock-mantle.${region}.api.aws/v1`);
    } else {
      setBaseUrl(preset.baseUrl);
    }
    if (preset.models?.[0]?.id) {
      const current = useCustomModel ? customModel : model;
      if (!current || !preset.models.some((m) => m.id === current)) {
        setModel(preset.models[0].id);
        setUseCustomModel(false);
      }
    }
  }, [provider]);
  useEffect(() => {
    if (provider !== "bedrock") return;
    const region = bedrockRegion.trim().toLowerCase() || "us-east-1";
    setBaseUrl(`https://bedrock-mantle.${region}.api.aws/v1`);
  }, [provider, bedrockRegion]);
  const saveConfig2 = async () => {
    if (!apiKey.trim()) {
      setError("API key is required.");
      return;
    }
    const resolvedModel = (useCustomModel ? customModel : model).trim();
    if (!resolvedModel) {
      setError("Model is required.");
      return;
    }
    const next = {
      ...config,
      provider,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      bedrockRegion: bedrockRegion.trim().toLowerCase() || "us-east-1",
      model: resolvedModel,
      customProtocol: provider === "anthropic" ? "anthropic" : "openai",
      openaiMode: "responses"
    };
    setError("");
    await headlessSaveConfig(next);
    saveBrowserConfig(next);
    setConfig(next);
    setAppConfig(next);
    setIsConfigured(true);
    setSuccess("Saved.");
    setTimeout(() => setSuccess(""), 2e3);
  };
  const testConfig = async () => {
    setTesting(true);
    setError("");
    setSuccess("");
    try {
      const resolvedModel = (useCustomModel ? customModel : model).trim();
      const result = await testApiConnectionBrowser({
        provider,
        apiKey,
        baseUrl,
        bedrockRegion: bedrockRegion.trim().toLowerCase() || "us-east-1",
        model: resolvedModel,
        customProtocol: provider === "anthropic" ? "anthropic" : "openai"
      });
      if (!result.ok) {
        setError(result.details || "API test failed.");
      } else {
        setSuccess("Connection successful.");
      }
    } finally {
      setTesting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    error && /* @__PURE__ */ jsx(Banner, { tone: "error", text: error }),
    success && /* @__PURE__ */ jsx(Banner, { tone: "success", text: success }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxs("label", { className: "text-sm", children: [
        "Provider",
        /* @__PURE__ */ jsxs("select", { className: "input mt-1", value: provider, onChange: (e) => setProvider(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "openrouter", children: "OpenRouter" }),
          /* @__PURE__ */ jsx("option", { value: "openai", children: "OpenAI" }),
          /* @__PURE__ */ jsx("option", { value: "anthropic", children: "Anthropic" }),
          /* @__PURE__ */ jsx("option", { value: "bedrock", children: "Bedrock" }),
          /* @__PURE__ */ jsx("option", { value: "custom", children: "Custom" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "text-sm", children: [
        "Model (Preset)",
        /* @__PURE__ */ jsx("select", { className: "input mt-1", value: model, onChange: (e) => {
          setModel(e.target.value);
          setUseCustomModel(false);
        }, children: models.map((m) => /* @__PURE__ */ jsx("option", { value: m.id, children: m.name }, m.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "text-sm", children: [
      "Custom Model (optional)",
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "input mt-1",
          value: useCustomModel ? customModel : "",
          placeholder: "Enter custom model ID",
          onChange: (e) => {
            const next = e.target.value;
            setCustomModel(next);
            setUseCustomModel(Boolean(next.trim()));
          }
        }
      )
    ] }),
    provider === "bedrock" && /* @__PURE__ */ jsxs("label", { className: "text-sm", children: [
      "AWS Region",
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "input mt-1",
          value: bedrockRegion,
          onChange: (e) => setBedrockRegion(e.target.value),
          placeholder: "us-east-1"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "text-sm", children: [
      "Base URL",
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "input mt-1",
          value: baseUrl,
          onChange: (e) => setBaseUrl(e.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "text-sm", children: [
      "API Key",
      /* @__PURE__ */ jsx("input", { className: "input mt-1", type: "password", value: apiKey, onChange: (e) => setApiKey(e.target.value) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => void testConfig(), disabled: testing, children: testing ? "Testing..." : "Test" }),
      /* @__PURE__ */ jsxs("button", { className: "btn btn-primary", onClick: () => void saveConfig2(), children: [
        /* @__PURE__ */ jsx(Save, { className: "w-4 h-4" }),
        /* @__PURE__ */ jsx("span", { children: "Save" })
      ] })
    ] })
  ] });
}
function SandboxTab() {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsx(Banner, { tone: "info", text: "Sandbox controls are removed in headless mode. Isolation is handled by your container/VM runtime." }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-text-secondary", children: "Configure host-level security (container user, seccomp/apparmor, IAM, network policy) outside this app." })
  ] });
}
function CredentialsTab() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ type: "api" });
  const [editingId, setEditingId] = useState(null);
  const load = async () => {
    try {
      setItems(await headlessGetCredentials());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    if (!draft.name?.trim() || !draft.username?.trim()) return;
    if (editingId) {
      await headlessUpdateCredential(editingId, draft);
    } else {
      await headlessSaveCredential({
        name: draft.name.trim(),
        type: draft.type || "other",
        username: draft.username.trim(),
        password: draft.password,
        service: draft.service,
        url: draft.url,
        notes: draft.notes
      });
    }
    setDraft({ type: "api" });
    setEditingId(null);
    await load();
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    error && /* @__PURE__ */ jsx(Banner, { tone: "error", text: error }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2", children: [
      /* @__PURE__ */ jsx("input", { className: "input", placeholder: "Name", value: draft.name || "", onChange: (e) => setDraft((d) => ({ ...d, name: e.target.value })) }),
      /* @__PURE__ */ jsx("input", { className: "input", placeholder: "Username", value: draft.username || "", onChange: (e) => setDraft((d) => ({ ...d, username: e.target.value })) }),
      /* @__PURE__ */ jsx("input", { className: "input", placeholder: "Secret/Password", type: "password", value: draft.password || "", onChange: (e) => setDraft((d) => ({ ...d, password: e.target.value })) })
    ] }),
    /* @__PURE__ */ jsxs("button", { className: "btn btn-primary", onClick: () => void save(), children: [
      editingId ? "Update" : "Save",
      " Credential"
    ] }),
    /* @__PURE__ */ jsx("div", { className: "space-y-2", children: items.map((item) => /* @__PURE__ */ jsxs("div", { className: "p-3 rounded border border-border bg-surface-muted flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-medium", children: item.name }),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: item.username })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => {
          setEditingId(item.id);
          setDraft(item);
        }, children: "Edit" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost text-error", onClick: () => void headlessDeleteCredential(item.id).then(load), children: /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" }) })
      ] })
    ] }, item.id)) })
  ] });
}
function ConnectorsTab() {
  const [servers, setServers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [tools, setTools] = useState([]);
  const [presets, setPresets] = useState({});
  const [error, setError] = useState("");
  const loadAll = async () => {
    try {
      const [s, st, t2, p] = await Promise.all([
        headlessGetMcpServers(),
        headlessGetMcpServerStatus(),
        headlessGetMcpTools(),
        headlessGetMcpPresets()
      ]);
      setServers(s);
      setStatuses(st);
      setTools(t2);
      setPresets(p);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void loadAll();
    const timer = setInterval(() => void loadAll(), 4e3);
    return () => clearInterval(timer);
  }, []);
  const addPreset = async (key) => {
    const preset = presets[key];
    if (!preset) return;
    await headlessSaveMcpServer({
      id: `mcp-${key}-${Date.now()}`,
      name: preset.name || key,
      type: preset.type || "stdio",
      command: preset.command,
      args: Array.isArray(preset.args) ? preset.args : [],
      env: preset.env || {},
      url: preset.url,
      headers: preset.headers || {},
      enabled: true
    });
    await loadAll();
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    error && /* @__PURE__ */ jsx(Banner, { tone: "error", text: error }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2", children: Object.keys(presets).map((key) => /* @__PURE__ */ jsxs("button", { className: "btn btn-secondary", onClick: () => void addPreset(key), children: [
      "Add Preset: ",
      presets[key].name || key
    ] }, key)) }),
    /* @__PURE__ */ jsx("div", { className: "space-y-2", children: servers.map((server) => {
      const status = statuses.find((s) => s.id === server.id);
      const count = tools.filter((t2) => t2.serverId === server.id).length || status?.toolCount || 0;
      return /* @__PURE__ */ jsxs("div", { className: "p-3 rounded border border-border bg-surface-muted flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "text-sm font-medium", children: server.name }),
          /* @__PURE__ */ jsxs("div", { className: "text-xs text-text-muted", children: [
            server.type,
            " • ",
            status?.connected ? "connected" : "disabled",
            " • ",
            count,
            " tools"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => void headlessSaveMcpServer({ ...server, enabled: !server.enabled }).then(loadAll), children: server.enabled ? "Disable" : "Enable" }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-ghost text-error", onClick: () => void headlessDeleteMcpServer(server.id).then(loadAll), children: /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" }) })
        ] })
      ] }, server.id);
    }) })
  ] });
}
function SkillsTab() {
  const [skills2, setSkills] = useState([]);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setSkills(await headlessGetSkills());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const install = async () => {
    const folderPath = window.prompt("Skill folder path (must contain SKILL.md):");
    if (!folderPath?.trim()) return;
    const validation = await headlessValidateSkillPath(folderPath.trim());
    if (!validation.valid) {
      setError(validation.errors.join(", "));
      return;
    }
    await headlessInstallSkill(folderPath.trim());
    await load();
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    error && /* @__PURE__ */ jsx(Banner, { tone: "error", text: error }),
    /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: () => void install(), children: "Install Skill From Path" }),
    /* @__PURE__ */ jsx("div", { className: "space-y-2", children: skills2.map((skill) => /* @__PURE__ */ jsxs("div", { className: "p-3 rounded border border-border bg-surface-muted flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-medium", children: skill.name }),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: skill.type })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => void headlessSetSkillEnabled(skill.id, !skill.enabled).then(load), children: skill.enabled ? "Disable" : "Enable" }),
        skill.type !== "builtin" && /* @__PURE__ */ jsx("button", { className: "btn btn-ghost text-error", onClick: () => void headlessDeleteSkill(skill.id).then(load), children: /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" }) })
      ] })
    ] }, skill.id)) })
  ] });
}
function LogsTab() {
  const [files, setFiles] = useState([]);
  const [dir, setDir] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = async () => {
    try {
      const [logs2, isEnabled] = await Promise.all([headlessGetLogs(), headlessLogsIsEnabled()]);
      setFiles(logs2.files);
      setDir(logs2.directory);
      setEnabled(isEnabled);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 3e3);
    return () => clearInterval(timer);
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    error && /* @__PURE__ */ jsx(Banner, { tone: "error", text: error }),
    success && /* @__PURE__ */ jsx(Banner, { tone: "success", text: success }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => void headlessLogsSetEnabled(!enabled).then(() => setEnabled((v) => !v)), children: enabled ? "Disable Dev Logs" : "Enable Dev Logs" }),
      /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => void headlessLogsExport().then((r) => setSuccess(`Exported: ${r.path}`)), children: "Export" }),
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost text-error", onClick: () => void headlessLogsClear().then(() => {
        setSuccess("Logs cleared.");
        void load();
      }), children: "Clear" })
    ] }),
    dir && /* @__PURE__ */ jsxs("div", { className: "text-xs text-text-muted", children: [
      "Directory: ",
      /* @__PURE__ */ jsx("span", { className: "font-mono", children: dir })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "space-y-1 max-h-[380px] overflow-y-auto", children: files.map((file) => /* @__PURE__ */ jsxs("div", { className: "p-2 rounded border border-border bg-surface-muted text-sm flex justify-between", children: [
      /* @__PURE__ */ jsx("span", { className: "font-mono truncate max-w-[60%]", children: file.name }),
      /* @__PURE__ */ jsxs("span", { className: "text-text-muted text-xs", children: [
        (file.size / 1024).toFixed(1),
        " KB"
      ] })
    ] }, file.path)) })
  ] });
}
function Banner({ tone, text }) {
  const style = tone === "error" ? "bg-error/10 text-error" : tone === "success" ? "bg-success/10 text-success" : "bg-blue-500/10 text-blue-600";
  return /* @__PURE__ */ jsxs("div", { className: `px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${style}`, children: [
    tone === "error" && /* @__PURE__ */ jsx(AlertCircle, { className: "w-4 h-4" }),
    tone === "success" && /* @__PURE__ */ jsx(CheckCircle, { className: "w-4 h-4" }),
    tone === "info" && /* @__PURE__ */ jsx(Shield, { className: "w-4 h-4" }),
    /* @__PURE__ */ jsx("span", { children: text })
  ] });
}
function Sidebar() {
  const {
    settings: settings2,
    sidebarCollapsed,
    toggleSidebar,
    updateSettings,
    activeSessionId,
    setActiveSession,
    sessions,
    sessionProjectMap,
    projects,
    activeProjectId,
    setProjects,
    setActiveProjectId,
    upsertProject,
    removeProject,
    isConfigured
  } = useAppStore();
  const { deleteSession } = useIPC();
  const [showSettings, setShowSettings] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [error, setError] = useState(null);
  const refreshProjects = useCallback(async () => {
    try {
      const payload = await headlessGetProjects();
      setProjects(payload.projects);
      setActiveProjectId(payload.activeProject?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [setProjects, setActiveProjectId]);
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);
  const projectSessions = useMemo(() => {
    if (!activeProjectId) return [];
    return sessions.filter((session) => sessionProjectMap[session.id] === activeProjectId);
  }, [sessions, sessionProjectMap, activeProjectId]);
  const toggleTheme = () => {
    updateSettings({ theme: settings2.theme === "dark" ? "light" : "dark" });
  };
  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setError(null);
    try {
      const created = await headlessCreateProject(name);
      setNewProjectName("");
      upsertProject(created);
      setActiveProjectId(created.id);
      setActiveSession(null);
      await headlessSetActiveProject(created.id);
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleSelectProject = async (projectId) => {
    setError(null);
    try {
      setActiveProjectId(projectId);
      setActiveSession(null);
      await headlessSetActiveProject(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleRenameProject = async (projectId, currentName) => {
    const nextName = window.prompt("Rename project", currentName);
    if (!nextName || !nextName.trim() || nextName.trim() === currentName) return;
    setError(null);
    try {
      const updated = await headlessUpdateProject(projectId, { name: nextName.trim() });
      upsertProject(updated);
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleDeleteProject = async (projectId, projectName) => {
    const confirmed = window.confirm(`Delete project "${projectName}"?`);
    if (!confirmed) return;
    setError(null);
    try {
      await headlessDeleteProject(projectId);
      removeProject(projectId);
      setActiveSession(null);
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: `bg-surface border-r border-border flex flex-col overflow-hidden transition-all duration-200 ${sidebarCollapsed ? "w-16" : "w-80"}`, children: [
    /* @__PURE__ */ jsx("div", { className: `border-b border-border ${sidebarCollapsed ? "p-2" : "px-3 py-3"} flex items-center gap-2`, children: sidebarCollapsed ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("button", { onClick: toggleSidebar, className: "w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary", children: /* @__PURE__ */ jsx(ChevronRight, { className: "w-4 h-4" }) }),
      /* @__PURE__ */ jsx("button", { onClick: toggleTheme, className: "w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary", children: settings2.theme === "dark" ? /* @__PURE__ */ jsx(Sun, { className: "w-4 h-4" }) : /* @__PURE__ */ jsx(Moon, { className: "w-4 h-4" }) })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center", children: /* @__PURE__ */ jsx(FolderKanban, { className: "w-4 h-4 text-accent" }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-sm font-semibold truncate", children: "Projects" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: "Project-first workspace" })
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: toggleTheme, className: "w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary", children: settings2.theme === "dark" ? /* @__PURE__ */ jsx(Sun, { className: "w-4 h-4" }) : /* @__PURE__ */ jsx(Moon, { className: "w-4 h-4" }) }),
      /* @__PURE__ */ jsx("button", { onClick: toggleSidebar, className: "w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary", children: /* @__PURE__ */ jsx(ChevronLeft, { className: "w-4 h-4" }) })
    ] }) }),
    !sidebarCollapsed && /* @__PURE__ */ jsxs("div", { className: "p-3 border-b border-border space-y-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "input text-sm py-2",
            placeholder: "Create project",
            value: newProjectName,
            onChange: (event) => setNewProjectName(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreateProject();
              }
            }
          }
        ),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary px-3", onClick: () => void handleCreateProject(), children: /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }) })
      ] }),
      error && /* @__PURE__ */ jsx("div", { className: "text-xs text-error", children: error })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `flex-1 overflow-y-auto ${sidebarCollapsed ? "px-2 py-2" : "p-3"} space-y-4`, children: [
      !sidebarCollapsed && /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs uppercase tracking-wide text-text-muted px-1", children: "Projects" }),
        projects.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-sm text-text-muted px-1 py-2", children: "Create your first project to begin." }) : projects.map((project) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: `group border rounded-lg px-2 py-2 ${project.id === activeProjectId ? "border-accent/40 bg-accent-muted" : "border-border bg-surface-muted"}`,
            children: [
              /* @__PURE__ */ jsxs("button", { className: "w-full text-left", onClick: () => void handleSelectProject(project.id), children: [
                /* @__PURE__ */ jsx("div", { className: "text-sm font-medium truncate", children: project.name }),
                /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted truncate", children: project.description || "No description" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [
                /* @__PURE__ */ jsx("button", { className: "w-6 h-6 rounded hover:bg-surface-hover text-text-muted", onClick: () => void handleRenameProject(project.id, project.name), children: /* @__PURE__ */ jsx(Pencil, { className: "w-3.5 h-3.5" }) }),
                /* @__PURE__ */ jsx("button", { className: "w-6 h-6 rounded hover:bg-surface-hover text-error", onClick: () => void handleDeleteProject(project.id, project.name), children: /* @__PURE__ */ jsx(Trash2, { className: "w-3.5 h-3.5" }) })
              ] })
            ]
          },
          project.id
        ))
      ] }),
      !sidebarCollapsed && activeProjectId && /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs uppercase tracking-wide text-text-muted px-1", children: "Tasks" }),
        projectSessions.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-sm text-text-muted px-1 py-2", children: "No tasks yet in this project." }) : projectSessions.map((session) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: `group flex items-center gap-2 px-2 py-2 rounded-lg border ${activeSessionId === session.id ? "border-accent/40 bg-accent-muted" : "border-border bg-surface-muted"}`,
            children: [
              /* @__PURE__ */ jsxs("button", { className: "flex-1 text-left min-w-0", onClick: () => setActiveSession(session.id), children: [
                /* @__PURE__ */ jsx("div", { className: "text-sm truncate", children: session.title }),
                /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: session.status })
              ] }),
              /* @__PURE__ */ jsx("button", { className: "w-6 h-6 rounded hover:bg-surface-hover text-error opacity-0 group-hover:opacity-100", onClick: () => deleteSession(session.id), children: /* @__PURE__ */ jsx(Trash2, { className: "w-3.5 h-3.5" }) })
            ]
          },
          session.id
        ))
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "p-3 border-t border-border", children: /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setShowSettings(true),
        className: `w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2 rounded-xl hover:bg-surface-hover transition-colors group`,
        children: sidebarCollapsed ? /* @__PURE__ */ jsx(Settings, { className: "w-4 h-4 text-text-muted" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium", children: "U" }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0 text-left", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-text-primary", children: "User" }),
              /* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full ${isConfigured ? "bg-success" : "bg-amber-500"}` })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: isConfigured ? "API configured" : "API not configured" })
          ] }),
          /* @__PURE__ */ jsx(Settings, { className: "w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" })
        ] })
      }
    ) }),
    showSettings && /* @__PURE__ */ jsx(SettingsPanel, { isOpen: showSettings, onClose: () => setShowSettings(false) })
  ] });
}
function resolveArtifactPath(pathValue, cwd) {
  if (!pathValue) {
    return pathValue;
  }
  if (/^(?:[A-Za-z]:\\|\\\\|\/)/.test(pathValue)) {
    if (pathValue.startsWith("/workspace/")) {
      const base2 = (cwd || "").replace(/[\\/]+$/, "");
      return base2 ? `${base2}${pathValue.slice("/workspace".length)}` : pathValue;
    }
    return pathValue;
  }
  const base = (cwd || "").replace(/[\\/]+$/, "");
  if (!base) {
    return pathValue;
  }
  return `${base}/${pathValue}`;
}
function extractFilePathFromToolOutput(toolOutput) {
  if (!toolOutput) {
    return null;
  }
  const trimmed = toolOutput.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.filePath === "string" && parsed.filePath.trim()) {
        return parsed.filePath.trim();
      }
      if (typeof parsed.path === "string" && parsed.path.trim()) {
        return parsed.path.trim();
      }
    }
  } catch {
  }
  const match = trimmed.match(/File (?:written|edited):\s*(.+)$/i) || trimmed.match(/File created successfully at:?\s*(.+)$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}
const FILE_TOOL_NAMES = /* @__PURE__ */ new Set([
  "write_file",
  "edit_file",
  "Write",
  "Edit",
  "NotebookEdit",
  "notebook_edit"
]);
function getArtifactLabel(pathValue, name) {
  const trimmedName = name?.trim();
  const trimmedPath = pathValue.trim();
  if (trimmedPath) {
    const normalized = trimmedPath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || trimmedPath;
  }
  return trimmedName ?? "";
}
const extensionIconMap = {
  pptx: "slides",
  ppt: "slides",
  key: "slides",
  keynote: "slides",
  xlsx: "table",
  xls: "table",
  csv: "table",
  tsv: "table",
  docx: "doc",
  doc: "doc",
  pdf: "doc",
  md: "code",
  markdown: "code",
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  py: "code",
  java: "code",
  go: "code",
  rs: "code",
  c: "code",
  cpp: "code",
  h: "code",
  hpp: "code",
  css: "code",
  scss: "code",
  html: "code",
  json: "code",
  lock: "code",
  yaml: "code",
  yml: "code",
  txt: "text",
  log: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  mp4: "video",
  mov: "video",
  mkv: "video",
  webm: "video",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive"
};
function getArtifactIconKey(filename) {
  const normalized = filename.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot === -1 || lastDot === normalized.length - 1) {
    return "file";
  }
  const ext = normalized.slice(lastDot + 1);
  return extensionIconMap[ext] ?? "file";
}
function getArtifactIconComponent(filename) {
  const key = getArtifactIconKey(filename);
  switch (key) {
    case "slides":
      return "presentation";
    case "table":
      return "table";
    case "doc":
      return "document";
    case "code":
      return "code";
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "archive":
      return "archive";
    case "text":
      return "text";
    default:
      return "file";
  }
}
function getArtifactSteps(steps) {
  const artifactSteps = steps.filter(
    (step) => step.type === "tool_result" && step.toolName === "artifact"
  );
  const fileSteps = steps.filter((step) => {
    if (step.status !== "completed") {
      return false;
    }
    if (!step.toolName || !FILE_TOOL_NAMES.has(step.toolName)) {
      return false;
    }
    return step.type === "tool_result" || step.type === "tool_call";
  });
  return {
    artifactSteps,
    fileSteps,
    displayArtifactSteps: artifactSteps.length > 0 ? artifactSteps : fileSteps
  };
}
function extractUrls(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  const matches = text.match(/https?:\/\/[^\s)"]+/g) || [];
  return Array.from(new Set(matches)).slice(0, 20);
}
function hostFromUrl(raw) {
  try {
    return new URL(raw).host;
  } catch {
    return raw;
  }
}
function buildPhasePlan(run, traces) {
  const events = Array.isArray(run?.events) ? run.events : [];
  const eventTypes = new Set(events.map((event) => event.type));
  const startedTools = events.filter((event) => event.type === "tool_call_started");
  const finishedTools = events.filter((event) => event.type === "tool_call_finished");
  const toolNames = startedTools.map((event) => String((event.payload || {}).toolName || "").toLowerCase()).filter(Boolean);
  const retrieveToolPattern = /(web_search|web_fetch|read|grep|glob|search|query|rag)/i;
  const retrieveStarted = toolNames.some((name) => retrieveToolPattern.test(name));
  const retrieveFinished = finishedTools.some((event) => {
    const name = String((event.payload || {}).toolName || "").toLowerCase();
    return retrieveToolPattern.test(name);
  });
  const executeStarted = startedTools.length > 0 || traces.some((trace) => trace.type === "tool_call");
  const executeFinished = finishedTools.length > 0 || traces.some((trace) => trace.type === "tool_result");
  const executeErrored = finishedTools.some((event) => !Boolean((event.payload || {}).ok));
  const runFailed = run?.status === "failed";
  const runCompleted = run?.status === "completed";
  const phases = [
    {
      key: "plan",
      label: "Plan",
      status: eventTypes.has("chat_requested") || eventTypes.has("model_turn_started") || traces.length > 0 ? runFailed && !eventTypes.has("model_turn_started") ? "error" : "completed" : "pending",
      detail: eventTypes.has("chat_requested") ? "Task accepted by orchestrator" : "Awaiting orchestration"
    },
    {
      key: "retrieve",
      label: "Retrieve",
      status: retrieveFinished ? "completed" : retrieveStarted ? "running" : runFailed && retrieveStarted ? "error" : "pending",
      detail: retrieveFinished ? "Sources collected and scanned" : retrieveStarted ? "Searching and gathering evidence" : "No retrieval activity yet"
    },
    {
      key: "execute",
      label: "Execute",
      status: executeErrored ? "error" : executeFinished ? "completed" : executeStarted ? "running" : "pending",
      detail: executeFinished ? `${finishedTools.length || traces.filter((trace) => trace.type === "tool_result").length} tool steps finished` : executeStarted ? "Tool execution in progress" : "Execution not started"
    },
    {
      key: "synthesize",
      label: "Synthesize",
      status: eventTypes.has("assistant_response") || runCompleted ? "completed" : runFailed ? "error" : run ? "running" : "pending",
      detail: eventTypes.has("assistant_response") || runCompleted ? "Response generated" : runFailed ? "Failed before response synthesis" : "Preparing response"
    },
    {
      key: "validate",
      label: "Validate",
      status: runCompleted && eventTypes.has("chat_completed") ? "completed" : runFailed ? "error" : eventTypes.has("assistant_response") || runCompleted ? "running" : "pending",
      detail: runCompleted && eventTypes.has("chat_completed") ? "Final response committed" : runFailed ? "Validation failed" : "Final checks pending"
    }
  ];
  return phases;
}
function ContextPanel() {
  const {
    activeSessionId,
    sessions,
    traceStepsBySession,
    contextPanelCollapsed,
    toggleContextPanel,
    workingDir,
    sessionProjectMap,
    sessionRunMap,
    setSessionPlanSnapshot
  } = useAppStore();
  const [run, setRun] = useState(null);
  const activeSession = activeSessionId ? sessions.find((session) => session.id === activeSessionId) || null : null;
  const steps = activeSessionId ? traceStepsBySession[activeSessionId] || [] : [];
  const currentWorkingDir = activeSession?.cwd || workingDir;
  const { artifactSteps, displayArtifactSteps } = getArtifactSteps(steps);
  const activeProjectId = activeSessionId ? sessionProjectMap[activeSessionId] : void 0;
  const activeRunId = activeSessionId ? sessionRunMap[activeSessionId] : void 0;
  useEffect(() => {
    let mounted = true;
    const loadRun = async () => {
      if (!activeProjectId || !activeRunId) {
        if (mounted) setRun(null);
        return;
      }
      const found = await headlessGetRun(activeProjectId, activeRunId);
      if (mounted) setRun(found);
    };
    void loadRun();
    const interval = setInterval(loadRun, 4e3);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeProjectId, activeRunId]);
  const phaseSteps = useMemo(() => buildPhasePlan(run, steps), [run, steps]);
  useEffect(() => {
    if (!activeSessionId) return;
    setSessionPlanSnapshot(activeSessionId, {
      sessionId: activeSessionId,
      runId: activeRunId,
      projectId: activeProjectId,
      phases: phaseSteps.map((phase) => ({
        key: phase.key,
        label: phase.label,
        status: phase.status
      })),
      updatedAt: Date.now()
    });
  }, [activeSessionId, activeRunId, activeProjectId, phaseSteps, setSessionPlanSnapshot]);
  const progress = useMemo(() => {
    const total = phaseSteps.length;
    if (!total) return 0;
    const completed = phaseSteps.filter((step) => step.status === "completed").length;
    return Math.round(completed / total * 100);
  }, [phaseSteps]);
  const runEvents = Array.isArray(run?.events) ? run.events : [];
  const resources = useMemo(() => {
    const tools = /* @__PURE__ */ new Set();
    const skills2 = /* @__PURE__ */ new Set();
    const sources = /* @__PURE__ */ new Set();
    const collections = /* @__PURE__ */ new Set();
    for (const step of steps) {
      if (step.toolName) {
        tools.add(step.toolName);
        if (step.toolName.startsWith("mcp__")) {
          skills2.add(step.toolName.replace("mcp__", "").replace(/__/g, ": "));
        }
      }
      extractUrls(step.toolInput).forEach((url) => sources.add(url));
      extractUrls(step.toolOutput).forEach((url) => sources.add(url));
      const inputText = JSON.stringify(step.toolInput || {}).toLowerCase();
      if (inputText.includes("collection")) {
        collections.add("collection referenced in task execution");
      }
    }
    for (const event of runEvents) {
      if (event.type === "tool_call_started") {
        const toolName = String((event.payload || {}).toolName || "tool");
        tools.add(toolName);
        if (toolName.startsWith("mcp__")) {
          skills2.add(toolName.replace("mcp__", "").replace(/__/g, ": "));
        }
      }
      extractUrls(event.payload).forEach((url) => sources.add(url));
    }
    return {
      tools: Array.from(tools),
      skills: Array.from(skills2),
      sources: Array.from(sources),
      collections: Array.from(collections)
    };
  }, [steps, runEvents]);
  if (contextPanelCollapsed) {
    return /* @__PURE__ */ jsx("div", { className: "w-10 bg-surface border-l border-border flex items-start justify-center py-3", children: /* @__PURE__ */ jsx(
      "button",
      {
        onClick: toggleContextPanel,
        className: "w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors",
        title: "Expand panel",
        children: /* @__PURE__ */ jsx(ChevronLeft, { className: "w-4 h-4" })
      }
    ) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "w-80 bg-surface border-l border-border flex flex-col overflow-hidden", children: [
    /* @__PURE__ */ jsx("div", { className: "px-3 py-2 border-b border-border flex items-center justify-start", children: /* @__PURE__ */ jsx(
      "button",
      {
        onClick: toggleContextPanel,
        className: "w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors",
        title: "Collapse panel",
        children: /* @__PURE__ */ jsx(ChevronRight, { className: "w-4 h-4" })
      }
    ) }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-3 space-y-3", children: [
      /* @__PURE__ */ jsxs("section", { className: "rounded-xl border border-border bg-surface-muted p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold", children: [
            /* @__PURE__ */ jsx(Sparkles, { className: "w-4 h-4 text-accent" }),
            /* @__PURE__ */ jsx("span", { children: "Plan" })
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-xs text-text-muted", children: [
            progress,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "w-full h-2 rounded-full bg-background mb-3 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "h-full bg-accent rounded-full transition-all", style: { width: `${progress}%` } }) }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2", children: phaseSteps.map((phase) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2", children: [
          phase.status === "completed" ? /* @__PURE__ */ jsx(CheckCircle2, { className: "w-4 h-4 mt-0.5 text-success" }) : phase.status === "running" ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 mt-0.5 text-accent animate-spin" }) : phase.status === "error" ? /* @__PURE__ */ jsx(AlertCircle, { className: "w-4 h-4 mt-0.5 text-error" }) : /* @__PURE__ */ jsx(Circle, { className: "w-4 h-4 mt-0.5 text-text-muted" }),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm text-text-primary leading-tight", children: phase.label }),
            phase.detail && /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted truncate", children: phase.detail })
          ] })
        ] }, phase.key)) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "rounded-xl border border-border bg-surface-muted p-3 space-y-3", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold", children: "Resources Used" }),
        /* @__PURE__ */ jsx(ResourceList, { title: "Tools", icon: /* @__PURE__ */ jsx(Wrench, { className: "w-3.5 h-3.5" }), items: resources.tools, empty: "No tools used yet" }),
        /* @__PURE__ */ jsx(ResourceList, { title: "Skills", icon: /* @__PURE__ */ jsx(Sparkles, { className: "w-3.5 h-3.5" }), items: resources.skills, empty: "No skills used yet" }),
        /* @__PURE__ */ jsx(ResourceList, { title: "Collections", icon: /* @__PURE__ */ jsx(Database, { className: "w-3.5 h-3.5" }), items: resources.collections, empty: "No collections referenced" })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "rounded-xl border border-border bg-surface-muted p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold mb-2", children: [
          /* @__PURE__ */ jsx(Link2, { className: "w-4 h-4 text-accent" }),
          /* @__PURE__ */ jsx("span", { children: "Source Evidence" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "space-y-1", children: resources.sources.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: "No source evidence captured." }) : resources.sources.slice(0, 10).map((url) => /* @__PURE__ */ jsxs(
          "button",
          {
            className: "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg bg-background border border-border hover:bg-surface-hover",
            onClick: () => {
              window.open(url, "_blank", "noopener,noreferrer");
            },
            title: url,
            children: [
              /* @__PURE__ */ jsx(ExternalLink, { className: "w-3.5 h-3.5 text-text-muted" }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("div", { className: "text-xs font-medium truncate", children: hostFromUrl(url) }),
                /* @__PURE__ */ jsx("div", { className: "text-[10px] text-text-muted truncate", children: url })
              ] })
            ]
          },
          url
        )) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "rounded-xl border border-border bg-surface-muted p-3", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold mb-2", children: "Artifacts" }),
        /* @__PURE__ */ jsx("div", { className: "space-y-1", children: displayArtifactSteps.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: "No artifacts yet." }) : displayArtifactSteps.map((step, index) => {
          const fallbackPath = extractFilePathFromToolOutput(step.toolOutput);
          const label = artifactSteps.length > 0 ? getArtifactLabel(step.toolOutput || "", void 0) : fallbackPath ? getArtifactLabel(fallbackPath) : "Artifact";
          const iconComponent = getArtifactIconComponent(label);
          const Icon = iconComponent === "document" ? File : File;
          const path2 = fallbackPath ? resolveArtifactPath(fallbackPath, currentWorkingDir) : "";
          return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-2 py-1.5 rounded-lg bg-background border border-border", children: [
            /* @__PURE__ */ jsx(Icon, { className: "w-3.5 h-3.5 text-text-muted" }),
            /* @__PURE__ */ jsx("span", { className: "text-sm flex-1 truncate", children: label }),
            path2 ? /* @__PURE__ */ jsx("span", { className: "text-[10px] text-text-muted truncate max-w-[90px]", children: path2.split(/[/\\]/).pop() }) : null
          ] }, `${step.id}-${index}`);
        }) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "rounded-xl border border-border bg-surface-muted p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold mb-2", children: [
          /* @__PURE__ */ jsx(Activity, { className: "w-4 h-4 text-accent" }),
          /* @__PURE__ */ jsx("span", { children: "Plan Progress Events" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "space-y-1 max-h-[220px] overflow-y-auto", children: runEvents.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: "No run events yet for this task." }) : [...runEvents].reverse().slice(0, 24).map((event) => /* @__PURE__ */ jsxs("div", { className: "px-2 py-1.5 rounded-lg bg-background border border-border", children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs font-medium text-text-primary", children: event.type }),
          /* @__PURE__ */ jsx("div", { className: "text-[10px] text-text-muted truncate", children: new Date(event.timestamp).toLocaleTimeString() })
        ] }, event.id)) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "rounded-xl border border-border bg-surface-muted p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold mb-2", children: [
          /* @__PURE__ */ jsx(FolderOpen, { className: "w-4 h-4 text-accent" }),
          /* @__PURE__ */ jsx("span", { children: "Workspace" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted break-all", children: currentWorkingDir || "No working directory selected." }),
        activeRunId && /* @__PURE__ */ jsxs("div", { className: "text-xs text-text-muted mt-2", children: [
          "run: ",
          activeRunId
        ] })
      ] })
    ] })
  ] });
}
function ResourceList({
  title,
  icon,
  items,
  empty
}) {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "text-xs text-text-muted mb-1 flex items-center gap-1", children: [
      icon,
      /* @__PURE__ */ jsx("span", { children: title })
    ] }),
    items.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: empty }) : /* @__PURE__ */ jsx("div", { className: "space-y-1", children: items.slice(0, 6).map((item) => /* @__PURE__ */ jsx("div", { className: "text-xs px-2 py-1 rounded bg-background border border-border truncate", title: item, children: item }, `${title}-${item}`)) })
  ] });
}
const common = { "save": "Save", "cancel": "Cancel", "delete": "Delete", "edit": "Edit", "add": "Add", "close": "Close", "loading": "Loading...", "error": "Error", "success": "Success", "saving": "Saving...", "saved": "Saved successfully!", "sure": "Are you sure?", "yes": "Yes", "no": "No", "install": "Install", "optional": "optional" };
const welcome = { "title": "How can I help you today?", "createFile": "Create a file", "crunchData": "Crunch data", "organizeFiles": "Organize files", "checkEmails": "Check emails", "searchPapers": "Search & summarize papers", "summarizePapersToNotion": "Summarize papers to Notion", "selectWorkingFolder": "Select Working Folder (required)", "attachFiles": "Attach Files", "letsGo": "Let's go", "starting": "Starting...", "chromeRequired": "Chrome", "notionRequired": "Notion" };
const settings = { "title": "Settings", "apiSettings": "API Settings", "apiSettingsDesc": "Configure API provider and key", "sandbox": "Sandbox", "sandboxDesc": "Isolated execution environment", "credentials": "Saved Credentials", "credentialsDesc": "Manage login credentials", "connectors": "MCP Connectors", "connectorsDesc": "Browser & tool integrations", "skills": "Skills", "skillsDesc": "Manage custom skills", "logs": "Logs", "logsDesc": "View and export application logs", "language": "Language", "languageDesc": "Choose your preferred language" };
const language = { "english": "English", "chinese": "Chinese", "selectLanguage": "Select Language", "currentLanguage": "Current language" };
const api = { "provider": "API Provider", "apiKey": "API Key", "protocol": "Protocol", "baseUrl": "Base URL", "model": "Model", "usePreset": "Use Preset", "custom": "Custom", "moreModels": "More Models", "selectProtocol": "Select the compatible protocol for the service", "enterOpenAIUrl": "Enter OpenAI-compatible service URL", "enterAnthropicUrl": "Enter Anthropic-compatible service URL", "enterModelId": "Enter model ID, e.g., anthropic/claude-sonnet-4.5, openai/gpt-4o", "saveSettings": "Save Settings", "testConnection": "Test Connection", "testingConnection": "Testing...", "liveTest": "Live request verification", "liveTestHint": "Sends a minimal request and may consume a small quota", "enableThinking": "Enable Thinking Mode", "enableThinkingHint": "Show Claude's thinking process step by step. This provides more transparency but may increase token usage.", "testSuccess": "Connection successful ({{ms}}ms)", "testError": { "missing_key": "API Key is required", "missing_base_url": "Base URL is required for this provider", "unauthorized": "Invalid API Key or unauthorized", "not_found": "Endpoint not found. Check the Base URL", "rate_limited": "Rate limited or quota exceeded", "server_error": "Service error. Please try again later", "network_error": "Network error. Check your connection", "unknown": "Connection failed" } };
const sandbox = { "title": "Sandbox Environment", "wslDesc": "Run commands in WSL2 Linux environment for better isolation and security on Windows.", "limaDesc": "Run commands in Lima VM for better isolation and security on macOS.", "nativeDesc": "Commands run directly on your system (Linux native mode).", "enableSandbox": "Enable Sandbox Mode", "readyStatus": "Sandbox ready and running", "notReadyStatus": "Sandbox enabled but not fully configured", "disabledStatus": "Sandbox disabled - commands run directly on system", "enabledWillSetup": "Sandbox enabled. Setting up environment...", "disabled": "Sandbox mode disabled", "failedToLoad": "Failed to load sandbox status", "failedToSave": "Failed to save sandbox settings", "statusRefreshed": "Status refreshed", "checkFailed": "Failed to check sandbox status", "environmentStatus": "Environment Status", "checkStatus": "Check Status", "platform": "Platform", "mode": "Mode", "status": "Status", "native": "Native", "wslAvailable": "WSL2 Available", "limaAvailable": "Lima Available", "vmCreated": "VM Instance Created", "vmRunning": "VM Running", "wslNotInstalled": "WSL2 is not installed", "wslInstallHint": "Install WSL2 for better isolation. Run this command in PowerShell as Administrator:", "limaNotInstalled": "Lima is not installed", "limaInstallHint": "Install Lima for better isolation. Run this command in Terminal:", "linuxNative": "Linux runs commands natively without additional sandboxing.", "nodeInstalled": "Node.js installed successfully", "nodeInstallFailed": "Failed to install Node.js", "pythonInstalled": "Python installed successfully", "pythonInstallFailed": "Failed to install Python", "start": "Start", "stop": "Stop", "limaStarted": "Lima VM started", "limaStartFailed": "Failed to start Lima VM", "limaStopped": "Lima VM stopped", "limaStopFailed": "Failed to stop Lima VM", "settingUp": "Setting up...", "retrySetup": "Retry Setup", "setupComplete": "Sandbox setup complete", "setupFailed": "Sandbox setup failed", "helpText1": "Sandbox provides an isolated environment for running commands safely.", "helpText2": "WSL2 (Windows) or Lima VM (macOS) is required for full sandbox support." };
const mcp = { "noConnectors": "No connectors configured", "addConnector": "Add a connector to enable MCP tools", "toolsAvailable": "{{count}} tool available", "toolsAvailable_plural": "{{count}} tools available", "connected": "Connected", "notConnected": "Not connected", "connecting": "Connecting...", "chromeHint": "A new Chrome debug window will open automatically if port is unavailable", "quickAddPresets": "Quick Add Presets", "show": "Show", "hide": "Hide", "addCustomConnector": "Add Custom Connector", "configure": "Configure", "added": "Added", "requiresToken": "Requires Token", "editConnector": "Edit Connector", "addConnectorTitle": "Add Custom Connector", "name": "Name", "type": "Type", "command": "Command", "arguments": "Arguments", "spaceSeparated": "Space-separated arguments", "url": "URL", "enableConnector": "Enable this connector" };
const credentials = { "encrypted": "🔐 Securely Encrypted", "encryptedDesc": "Credentials are encrypted locally. The agent can use these to automatically log in to your accounts.", "noCredentials": "No saved credentials", "addCredential": "Add credentials for the agent to use", "addNewCredential": "Add New Credential", "editCredential": "Edit Credential", "name": "Name", "type": "Type", "service": "Service", "selectService": "Select a service...", "username": "Username / Email", "password": "Password", "passwordKeepCurrent": "(leave empty to keep current)", "loginUrl": "Login URL (optional)", "notes": "Notes (optional)", "deleteConfirm": "Are you sure you want to delete this credential?", "nameRequired": "Name and username are required", "passwordRequired": "Password is required for new credentials", "failedToLoad": "Failed to load credentials", "failedToSave": "Failed to save credential", "failedToDelete": "Failed to delete credential", "envVars": "Environment Variables", "enterEnvVar": "Enter environment variable name (e.g., NOTION_TOKEN):", "usedForTokens": "Used for tokens and secrets (e.g., NOTION_TOKEN)", "noEnvVars": "No environment variables configured" };
const skills = { "title": "📦 Skills", "description": "Skills extend Claude's capabilities with specialized knowledge and tools.", "builtinSkills": "Built-in Skills", "customSkills": "Custom Skills", "noCustomSkills": "No custom skills installed", "installSkillsDesc": "Install skills to extend Claude's capabilities", "installSkillFromFolder": "Install Skill from Folder", "deleteSkill": 'Delete skill "{{name}}"?', "failedToLoad": "Failed to load skills", "failedToInstall": "Failed to install skill", "failedToDelete": "Failed to delete skill", "failedToToggle": "Failed to toggle skill" };
const logs = { "title": "Application Logs", "description": "View and export application logs for debugging. Logs are automatically rotated when they exceed 10MB.", "enableDevLogs": "Enable Developer Logs", "enableDevLogsDesc": "Record detailed logs for debugging. Disable to reduce disk usage.", "devLogsEnabled": "Developer logs enabled", "devLogsDisabled": "Developer logs disabled", "toggleFailed": "Failed to toggle developer logs", "logFiles": "Log Files", "totalSize": "Total Size", "noLogFiles": "No log files found", "logsDirectory": "Logs Directory:", "exportZip": "Export ZIP", "openFolder": "Open Folder", "clearAll": "Clear All", "clearConfirm": "Are you sure you want to clear all log files? This action cannot be undone.", "exportSuccess": "Logs exported successfully to {{path}}", "clearSuccess": "Cleared {{count}} log file(s)", "exportFailed": "Failed to export logs", "clearFailed": "Failed to clear logs", "helpText1": "💡 Logs are useful for debugging issues with MCP connections and other problems.", "helpText2": "Export logs as a ZIP file to share with support or for your own analysis." };
const sidebar = { "recents": "Recents", "expandToView": "Expand to view tasks", "noTasks": "No tasks yet", "deleteAll": "Delete all conversations", "localTasks": "These tasks run locally and aren't synced across devices.", "apiConfigured": "API Configured", "apiNotConfigured": "API Not Configured", "user": "User", "newTask": "New task" };
const chat = { "sendMessage": "Send message", "stop": "Stop", "processing": "Processing...", "typeMessage": "Type a message...", "loadingConversation": "Loading conversation...", "startConversation": "Start the conversation", "connectorCount_one": "{{count}} connector", "connectorCount_other": "{{count}} connectors" };
const context = { "progress": "Progress", "artifacts": "Artifacts", "context": "Context", "workingDirectory": "Working Directory", "toolsUsed": "Tools Used", "mcpConnectors": "MCP Connectors", "copied": "Copied!", "noToolsUsedYet": "No tools used yet", "toolsUsedLabel": "Tools used:", "noFolderSelected": "No folder selected", "expandPanel": "Expand panel", "collapsePanel": "Collapse panel", "queuedMessages": "Queued messages: {{count}}", "stepsWillShow": "Steps will show as the task unfolds.", "noArtifactsYet": "No artifacts yet", "fileCreated": "File created", "callNumber": "Call #{{number}}", "input": "Input:", "output": "Output:" };
const messageCard = { "request": "Request" };
const permission = { "permissionRequired": "Permission Required", "tool": "Tool:", "input": "Input:", "warning": "This action may modify your system. Review carefully.", "deny": "Deny", "allow": "Allow", "alwaysAllow": "Always allow this tool", "useTool": "Use the {{toolName}} tool", "toolDescriptions": { "write": "Write to files on your system", "edit": "Edit existing files on your system", "bash": "Execute shell commands", "webFetch": "Fetch data from the web", "webSearch": "Search the web", "TodoRead": "Read the current todo list", "TodoWrite": "Update the current todo list", "read_file": "Read files in the workspace", "write_file": "Write files in the workspace", "edit_file": "Edit files in the workspace", "list_directory": "List directory contents in the workspace", "execute_command": "Execute shell commands in the workspace", "glob": "Search files by pattern", "grep": "Search file contents" } };
const en = {
  common,
  welcome,
  settings,
  language,
  api,
  sandbox,
  mcp,
  credentials,
  skills,
  logs,
  sidebar,
  chat,
  context,
  messageCard,
  permission
};
function getByPath(obj, path2) {
  return path2.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key];
    }
    return void 0;
  }, obj);
}
function formatTemplate(template, params) {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = params[key];
    return value === void 0 ? "" : String(value);
  });
}
function resolvePluralKey(key, params) {
  const count = params?.count;
  if (typeof count !== "number") return key;
  const oneKey = `${key}_one`;
  const otherKey = `${key}_other`;
  if (getByPath(en, oneKey) !== void 0 || getByPath(en, otherKey) !== void 0) {
    return count === 1 ? oneKey : otherKey;
  }
  const legacyPluralKey = `${key}_plural`;
  if (getByPath(en, legacyPluralKey) !== void 0) {
    return count === 1 ? key : legacyPluralKey;
  }
  return key;
}
function t(key, params) {
  const effectiveKey = resolvePluralKey(key, params);
  const value = getByPath(en, effectiveKey);
  if (typeof value !== "string") return key;
  return formatTemplate(value, params);
}
function useTranslation() {
  return {
    t,
    i18n: {
      language: "en",
      changeLanguage: async (_lang) => "en"
    }
  };
}
function PermissionDialog({ permission: permission2 }) {
  const { t: t2 } = useTranslation();
  const { respondToPermission } = useIPC();
  const getToolDescription = (toolName) => {
    const key = `permission.toolDescriptions.${toolName}`;
    const translated = t2(key);
    if (translated !== key) {
      return translated;
    }
    return t2("permission.useTool", { toolName });
  };
  const isHighRisk = [
    "bash",
    "write",
    "edit",
    "execute_command",
    "write_file",
    "edit_file"
  ].includes(permission2.toolName);
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in", children: /* @__PURE__ */ jsxs("div", { className: "card w-full max-w-md p-6 m-4 shadow-elevated animate-slide-up", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
      /* @__PURE__ */ jsx("div", { className: `w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isHighRisk ? "bg-warning/10" : "bg-accent-muted"}`, children: isHighRisk ? /* @__PURE__ */ jsx(AlertTriangle, { className: "w-6 h-6 text-warning" }) : /* @__PURE__ */ jsx(Shield, { className: "w-6 h-6 text-accent" }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-text-primary", children: t2("permission.permissionRequired") }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-text-secondary mt-1", children: getToolDescription(permission2.toolName) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 p-4 bg-surface-muted rounded-xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-text-primary", children: t2("permission.tool") }),
        /* @__PURE__ */ jsx("span", { className: "font-mono text-accent text-sm", children: permission2.toolName })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-sm text-text-secondary", children: [
        /* @__PURE__ */ jsx("span", { className: "font-medium text-text-primary", children: t2("permission.input") }),
        /* @__PURE__ */ jsx("pre", { className: "mt-1 text-xs code-block max-h-32 overflow-auto", children: JSON.stringify(permission2.input, null, 2) })
      ] })
    ] }),
    isHighRisk && /* @__PURE__ */ jsx("div", { className: "mt-4 p-3 bg-warning/10 border border-warning/20 rounded-xl", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2", children: [
      /* @__PURE__ */ jsx(AlertTriangle, { className: "w-4 h-4 text-warning mt-0.5 flex-shrink-0" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-warning", children: t2("permission.warning") })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 flex items-center gap-3", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => respondToPermission(permission2.toolUseId, "deny"),
          className: "flex-1 btn btn-secondary",
          children: [
            /* @__PURE__ */ jsx(X, { className: "w-4 h-4" }),
            t2("permission.deny")
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => respondToPermission(permission2.toolUseId, "allow"),
          className: "flex-1 btn btn-primary",
          children: [
            /* @__PURE__ */ jsx(Check, { className: "w-4 h-4" }),
            t2("permission.allow")
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => respondToPermission(permission2.toolUseId, "allow_always"),
        className: "w-full mt-2 btn btn-ghost text-sm",
        children: t2("permission.alwaysAllow")
      }
    )
  ] }) });
}
function inferBedrockRegion$1(baseUrl) {
  const value = String(baseUrl || "").toLowerCase();
  const runtimeMatch = value.match(/bedrock-runtime\.([a-z0-9-]+)\.amazonaws\.com/);
  if (runtimeMatch?.[1]) return runtimeMatch[1];
  const mantleMatch = value.match(/bedrock-mantle\.([a-z0-9-]+)\.api\.aws/);
  return mantleMatch?.[1] || "us-east-1";
}
const PROVIDER_LABELS = {
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  openai: "OpenAI",
  custom: "Custom",
  bedrock: "Bedrock"
};
function ConfigModal({ isOpen, onClose, onSave, initialConfig, isFirstRun }) {
  const [provider, setProvider] = useState("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [bedrockRegion, setBedrockRegion] = useState("us-east-1");
  const [customProtocol, setCustomProtocol] = useState("anthropic");
  const [model, setModel] = useState("");
  const [openaiMode, setOpenaiMode] = useState("responses");
  const [customModel, setCustomModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [useLiveTest, setUseLiveTest] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const skipPresetApplyRef = useRef(false);
  const previousProviderRef = useRef(provider);
  useEffect(() => {
    if (!isOpen) return;
    setIsInitialLoad(true);
    setPresets(FALLBACK_PRESETS);
  }, [isOpen]);
  useEffect(() => {
    if (initialConfig && presets) {
      skipPresetApplyRef.current = true;
      setProvider(initialConfig.provider);
      setApiKey(initialConfig.apiKey || "");
      setBaseUrl(initialConfig.baseUrl || "");
      setBedrockRegion(initialConfig.bedrockRegion || inferBedrockRegion$1(initialConfig.baseUrl));
      setCustomProtocol(initialConfig.customProtocol || "anthropic");
      setOpenaiMode("responses");
      const preset = presets?.[initialConfig.provider];
      const isPresetModel = preset?.models.some((m) => m.id === initialConfig.model);
      if (isPresetModel) {
        setModel(initialConfig.model || "");
        setUseCustomModel(false);
      } else if (initialConfig.model) {
        setUseCustomModel(true);
        setCustomModel(initialConfig.model);
      }
      setIsInitialLoad(false);
    }
  }, [initialConfig, presets]);
  useEffect(() => {
    if (!presets || !isInitialLoad || initialConfig) return;
    const preset = presets[provider];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setUseCustomModel(false);
      setModel(preset.models[0]?.id || "");
    }
    setIsInitialLoad(false);
  }, [presets, isInitialLoad, initialConfig, provider]);
  useEffect(() => {
    if (presets && !isInitialLoad) {
      if (skipPresetApplyRef.current) {
        skipPresetApplyRef.current = false;
        return;
      }
      const preset = presets[provider];
      if (preset) {
        if (provider === "custom") {
          if (previousProviderRef.current !== "custom") {
            setBaseUrl(preset.baseUrl);
          }
        } else {
          setBaseUrl(preset.baseUrl);
        }
        setUseCustomModel(false);
        setModel(preset.models[0]?.id || "");
      }
    }
    previousProviderRef.current = provider;
  }, [provider, presets, isInitialLoad]);
  useEffect(() => {
    if (provider === "openai" || provider === "bedrock" || provider === "custom" && customProtocol === "openai") {
      setOpenaiMode("responses");
    }
  }, [provider, customProtocol]);
  useEffect(() => {
    if (provider !== "bedrock") return;
    const nextRegion = bedrockRegion.trim().toLowerCase() || "us-east-1";
    setBaseUrl(`https://bedrock-mantle.${nextRegion}.api.aws/v1`);
  }, [provider, bedrockRegion]);
  useEffect(() => {
    setTestResult(null);
  }, [provider, apiKey, baseUrl, customProtocol, model, customModel, useCustomModel, bedrockRegion]);
  async function handleTest() {
    if (!apiKey.trim()) {
      setError("API Key is required");
      return;
    }
    const finalModel = useCustomModel ? customModel.trim() : model;
    if (!finalModel) {
      setError("Select or enter a model name");
      return;
    }
    setError("");
    setIsTesting(true);
    setTestResult(null);
    try {
      const presetBaseUrl = presets?.[provider]?.baseUrl;
      const resolvedBaseUrl = provider === "custom" || provider === "bedrock" ? baseUrl.trim() : (presetBaseUrl || baseUrl).trim();
      const request = {
        provider,
        apiKey: apiKey.trim(),
        baseUrl: resolvedBaseUrl || void 0,
        bedrockRegion,
        customProtocol,
        model: finalModel,
        useLiveRequest: useLiveTest
      };
      const result = await testApiConnectionBrowser(request);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        errorType: "unknown",
        details: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsTesting(false);
    }
  }
  async function handleSave() {
    if (!apiKey.trim()) {
      setError("API Key is required");
      return;
    }
    const finalModel = useCustomModel ? customModel.trim() : model;
    if (!finalModel) {
      setError("Select or enter a model name");
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      const presetBaseUrl = presets?.[provider]?.baseUrl;
      const resolvedBaseUrl = provider === "custom" || provider === "bedrock" ? baseUrl.trim() : (presetBaseUrl || baseUrl).trim();
      const resolvedOpenaiMode = provider === "openai" || provider === "bedrock" || provider === "custom" && customProtocol === "openai" ? "responses" : openaiMode;
      await onSave({
        provider,
        apiKey: apiKey.trim(),
        baseUrl: resolvedBaseUrl || void 0,
        bedrockRegion,
        customProtocol,
        model: finalModel,
        openaiMode: resolvedOpenaiMode
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1e3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }
  if (!isOpen) return null;
  const currentPreset = presets?.[provider];
  const testErrorMessage = (result) => {
    switch (result.errorType) {
      case "missing_key":
        return "API Key is required";
      case "missing_base_url":
        return "Base URL is required";
      case "unauthorized":
        return "Invalid or unauthorized API key";
      case "not_found":
        return "Endpoint not found. Check Base URL";
      case "rate_limited":
        return "Rate limited or quota exceeded";
      case "server_error":
        return "Server error. Try again later";
      case "network_error":
        return "Network error. Check URL or network";
      default:
        return "Connection failed";
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-border", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center", children: /* @__PURE__ */ jsx(Key, { className: "w-5 h-5 text-white" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-text-primary", children: isFirstRun ? "Welcome to Open Analyst" : "API Configuration" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-text-secondary", children: isFirstRun ? "API setup is required before first use" : "Update your API settings" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "p-2 rounded-lg hover:bg-surface-hover transition-colors",
          children: /* @__PURE__ */ jsx(X, { className: "w-5 h-5 text-text-secondary" })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "p-6 space-y-5 max-h-[60vh] overflow-y-auto", children: [
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm font-medium text-text-primary", children: [
          /* @__PURE__ */ jsx(Server, { className: "w-4 h-4" }),
          "API Provider"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-5 gap-2", children: ["openrouter", "anthropic", "openai", "bedrock", "custom"].map((p) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setProvider(p),
            className: `px-3 py-2 rounded-lg text-sm font-medium transition-all ${provider === p ? "bg-accent text-white" : "bg-surface-hover text-text-secondary hover:bg-surface-active"}`,
            children: presets?.[p]?.name || PROVIDER_LABELS[p] || p
          },
          p
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm font-medium text-text-primary", children: [
          /* @__PURE__ */ jsx(Key, { className: "w-4 h-4" }),
          "API Key"
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "password",
            value: apiKey,
            onChange: (e) => setApiKey(e.target.value),
            placeholder: currentPreset?.keyPlaceholder || "Enter your API key",
            className: "w-full px-4 py-3 rounded-xl bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          }
        ),
        currentPreset?.keyHint && /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: currentPreset.keyHint })
      ] }),
      provider === "custom" && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm font-medium text-text-primary", children: [
          /* @__PURE__ */ jsx(Server, { className: "w-4 h-4" }),
          "Protocol"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2", children: [
          { id: "anthropic", label: "Anthropic" },
          { id: "openai", label: "OpenAI" }
        ].map((mode) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setCustomProtocol(mode.id),
            className: `px-3 py-2 rounded-lg text-sm font-medium transition-all ${customProtocol === mode.id ? "bg-accent text-white" : "bg-surface-hover text-text-secondary hover:bg-surface-active"}`,
            children: mode.label
          },
          mode.id
        )) }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: "Select a compatible protocol for your provider" })
      ] }),
      provider === "custom" && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm font-medium text-text-primary", children: [
          /* @__PURE__ */ jsx(Server, { className: "w-4 h-4" }),
          "Base URL"
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: baseUrl,
            onChange: (e) => setBaseUrl(e.target.value),
            placeholder: customProtocol === "openai" ? "https://api.openai.com/v1" : currentPreset?.baseUrl || "https://api.anthropic.com",
            className: "w-full px-4 py-3 rounded-xl bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: customProtocol === "openai" ? "Enter an OpenAI-compatible base URL" : "Enter an Anthropic-compatible base URL" })
      ] }),
      provider === "bedrock" && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm font-medium text-text-primary", children: [
          /* @__PURE__ */ jsx(Server, { className: "w-4 h-4" }),
          "AWS Region"
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: bedrockRegion,
            onChange: (e) => setBedrockRegion(e.target.value),
            placeholder: "us-east-1",
            className: "w-full px-4 py-3 rounded-xl bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          }
        ),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-text-muted", children: [
          "Endpoint: ",
          baseUrl || "https://bedrock-mantle.us-east-1.api.aws/v1"
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm font-medium text-text-primary pt-1", children: [
          /* @__PURE__ */ jsx(Server, { className: "w-4 h-4" }),
          "Base URL"
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: baseUrl,
            onChange: (e) => setBaseUrl(e.target.value),
            placeholder: "https://bedrock-mantle.us-east-1.api.aws/v1",
            className: "w-full px-4 py-3 rounded-xl bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm font-medium text-text-primary", children: [
            /* @__PURE__ */ jsx(Cpu, { className: "w-4 h-4" }),
            "Model"
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setUseCustomModel(!useCustomModel),
              className: `flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all ${useCustomModel ? "bg-accent-muted text-accent" : "bg-surface-hover text-text-secondary hover:bg-surface-active"}`,
              children: [
                /* @__PURE__ */ jsx(Edit3, { className: "w-3 h-3" }),
                useCustomModel ? "Use Preset" : "Custom"
              ]
            }
          )
        ] }),
        useCustomModel ? /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: customModel,
            onChange: (e) => setCustomModel(e.target.value),
            placeholder: provider === "openrouter" ? "openai/gpt-4o or another model ID" : provider === "openai" || provider === "bedrock" || provider === "custom" && customProtocol === "openai" ? "gpt-4o" : "claude-sonnet-4",
            className: "w-full px-4 py-3 rounded-xl bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          }
        ) : /* @__PURE__ */ jsx(
          "select",
          {
            value: model,
            onChange: (e) => setModel(e.target.value),
            className: "w-full px-4 py-3 rounded-xl bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all appearance-none cursor-pointer",
            children: currentPreset?.models.length ? currentPreset.models.map((m) => /* @__PURE__ */ jsx("option", { value: m.id, children: m.name }, m.id)) : /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "No models available" })
          }
        ),
        useCustomModel && /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: "Enter model ID, e.g. anthropic/claude-sonnet-4.5, openai/gpt-4o, openai.gpt-oss-20b-1:0" })
      ] }),
      error && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-4 py-3 rounded-xl bg-error/10 text-error text-sm", children: [
        /* @__PURE__ */ jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }),
        error
      ] }),
      success && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-4 py-3 rounded-xl bg-success/10 text-success text-sm", children: [
        /* @__PURE__ */ jsx(CheckCircle, { className: "w-4 h-4 flex-shrink-0" }),
        "Saved successfully!"
      ] }),
      testResult && /* @__PURE__ */ jsxs("div", { className: `flex gap-2 px-4 py-3 rounded-xl text-sm ${testResult.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"}`, children: [
        testResult.ok ? /* @__PURE__ */ jsx(CheckCircle, { className: "w-4 h-4 flex-shrink-0" }) : /* @__PURE__ */ jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("div", { children: testResult.ok ? `Connection successful (${typeof testResult.latencyMs === "number" ? testResult.latencyMs : "--"}ms)` : testErrorMessage(testResult) }),
          !testResult.ok && testResult.details && /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs text-text-muted", children: testResult.details })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "px-6 py-4 bg-surface-hover border-t border-border", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-xs text-text-muted mb-3", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            id: "api-live-test-modal",
            checked: useLiveTest,
            onChange: (e) => setUseLiveTest(e.target.checked),
            className: "mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent"
          }
        ),
        /* @__PURE__ */ jsxs("label", { htmlFor: "api-live-test-modal", className: "space-y-0.5", children: [
          /* @__PURE__ */ jsx("div", { className: "text-text-primary", children: "Live request verification" }),
          /* @__PURE__ */ jsx("div", { children: "Sends one minimal request and may consume a small amount of quota" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleTest,
            disabled: isTesting || !apiKey.trim(),
            className: "w-full py-3 px-4 rounded-xl border border-border bg-surface text-text-primary font-medium hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2",
            children: isTesting ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }),
              "Testing..."
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Plug, { className: "w-4 h-4" }),
              "Test Connection"
            ] })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleSave,
            disabled: isSaving || !apiKey.trim(),
            className: "w-full py-3 px-4 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2",
            children: isSaving ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }),
              "Saving..."
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(CheckCircle, { className: "w-4 h-4" }),
              isFirstRun ? "Get Started" : "Save Configuration"
            ] })
          }
        )
      ] })
    ] })
  ] }) });
}
function Titlebar() {
  return /* @__PURE__ */ jsx("div", { className: "h-10 bg-background-secondary border-b border-border shrink-0 flex items-center px-4", children: /* @__PURE__ */ jsx("span", { className: "text-xs text-text-muted", children: "Open Analyst" }) });
}
const phaseConfig = {
  starting_agent: { icon: "🚀" },
  syncing_files: { icon: "📂" },
  syncing_skills: { icon: "🔧" },
  ready: { icon: "✅" },
  error: { icon: "❌" }
};
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function SandboxSyncToast({ status }) {
  const [isVisible, setIsVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  useEffect(() => {
    if (status && status.phase !== "ready") {
      setIsVisible(true);
      setFadeOut(false);
    } else if (status?.phase === "ready") {
      const timer = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          setIsVisible(false);
        }, 300);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [status]);
  if (!status || !isVisible) {
    return null;
  }
  const config = phaseConfig[status.phase];
  const isComplete = status.phase === "ready";
  const isError = status.phase === "error";
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: `fixed bottom-4 right-4 z-40 transition-all duration-300 ${fadeOut ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`,
      children: /* @__PURE__ */ jsxs("div", { className: "bg-surface/95 backdrop-blur-sm border border-border rounded-2xl shadow-xl max-w-sm overflow-hidden", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-3", children: [
          /* @__PURE__ */ jsx("div", { className: `text-xl ${isComplete ? "" : "animate-pulse"}`, children: config.icon }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsx("p", { className: `font-medium text-sm ${isComplete ? "text-green-500" : isError ? "text-red-500" : "text-accent"}`, children: status.message }),
            status.detail && /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted mt-0.5 truncate", children: status.detail })
          ] }),
          !isComplete && !isError && /* @__PURE__ */ jsx("div", { className: "flex-shrink-0", children: /* @__PURE__ */ jsx("div", { className: "w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" }) })
        ] }),
        status.fileCount !== void 0 && status.totalSize !== void 0 && /* @__PURE__ */ jsxs("div", { className: "px-4 py-2 bg-surface-muted border-t border-border flex items-center justify-between text-xs text-text-muted", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            status.fileCount,
            " files"
          ] }),
          /* @__PURE__ */ jsx("span", { children: formatSize(status.totalSize) })
        ] }),
        status.phase === "syncing_files" && /* @__PURE__ */ jsx("div", { className: "px-4 py-2.5 bg-accent-muted/50 border-t border-border", children: /* @__PURE__ */ jsxs("p", { className: "text-xs text-text-secondary leading-relaxed", children: [
          "Syncing project files to isolated sandbox for secure code execution.",
          /* @__PURE__ */ jsx("span", { className: "text-accent font-medium", children: " First sync is slower" }),
          ", incremental syncs will be faster."
        ] }) })
      ] })
    }
  );
}
const _app = UNSAFE_withComponentProps(function AppLayout() {
  const {
    activeSessionId,
    pendingPermission,
    settings: settings2,
    showConfigModal,
    isConfigured,
    appConfig,
    sandboxSyncStatus,
    setShowConfigModal,
    setIsConfigured,
    setAppConfig,
    setWorkingDir,
    setProjects,
    setActiveProjectId
  } = useAppStore();
  const {
    listSessions
  } = useIPC();
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    listSessions();
    const browserConfig = getBrowserConfig();
    setIsConfigured(Boolean(browserConfig.apiKey));
    setAppConfig(browserConfig);
    headlessGetWorkingDir().then((result) => {
      if (result?.workingDir) {
        setWorkingDir(result.workingDir);
      }
    }).catch(() => {
    });
    headlessGetProjects().then((payload) => {
      setProjects(payload.projects);
      setActiveProjectId(payload.activeProject?.id || null);
    }).catch(() => {
    });
  }, []);
  useEffect(() => {
    if (settings2.theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [settings2.theme]);
  const handleConfigSave = useCallback(async (newConfig) => {
    const saved = saveBrowserConfig(newConfig);
    headlessSaveConfig(saved).catch(() => {
    });
    setIsConfigured(Boolean(saved.apiKey));
    setAppConfig(saved);
  }, [setIsConfigured, setAppConfig]);
  const handleConfigClose = useCallback(() => {
    setShowConfigModal(false);
  }, [setShowConfigModal]);
  return /* @__PURE__ */ jsxs("div", {
    className: "h-screen w-screen flex flex-col overflow-hidden bg-background",
    children: [/* @__PURE__ */ jsx(Titlebar, {}), /* @__PURE__ */ jsxs("div", {
      className: "flex-1 flex overflow-hidden",
      children: [/* @__PURE__ */ jsx(Sidebar, {}), /* @__PURE__ */ jsx("main", {
        className: "flex-1 flex flex-col overflow-hidden bg-background",
        children: /* @__PURE__ */ jsx(Outlet, {})
      }), activeSessionId && /* @__PURE__ */ jsx(ContextPanel, {})]
    }), pendingPermission && /* @__PURE__ */ jsx(PermissionDialog, {
      permission: pendingPermission
    }), /* @__PURE__ */ jsx(ConfigModal, {
      isOpen: showConfigModal,
      onClose: handleConfigClose,
      onSave: handleConfigSave,
      initialConfig: appConfig,
      isFirstRun: !isConfigured
    }), /* @__PURE__ */ jsx(SandboxSyncToast, {
      status: sandboxSyncStatus
    })]
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _app
}, Symbol.toStringTag, { value: "Module" }));
const fileLinkButtonClassName = "text-accent hover:text-accent-hover underline underline-offset-2 text-left break-all inline-block";
function getFileLinkButtonClassName() {
  return fileLinkButtonClassName;
}
const boundaryPattern = /[\s\]\[\(\)\{\}<>"'“”‘’。.,，、:;!?：；]/;
const asciiFilenamePattern = /[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]{1,8}/gi;
const cjkFilenamePattern = new RegExp(
  `(?:^|${boundaryPattern.source})([\\p{Script=Han}0-9_-]+\\.[A-Za-z0-9]{1,8})`,
  "gu"
);
const pathPattern = /(?:[A-Za-z]:\\|\/)[^\n]+?\.[a-z0-9]{1,8}/gi;
function isBoundaryChar(ch) {
  if (!ch) return true;
  return boundaryPattern.test(ch);
}
function tokenHasUrlPrefix(text, index) {
  const tokenStart = text.lastIndexOf(" ", index) + 1;
  const token = text.slice(tokenStart, index);
  return /https?:\/\//i.test(token);
}
function trimTrailingPunctuation(value) {
  return value.replace(/[\]\[\(\)\{\}<>"'“”‘’。.,，、:;!?：；]+$/g, "");
}
function extensionHasLetter(value) {
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1 || lastDot === value.length - 1) {
    return false;
  }
  const ext = value.slice(lastDot + 1);
  return /[a-z]/i.test(ext);
}
function splitTextByFileMentions(text) {
  if (!text) {
    return [{ type: "text", value: "" }];
  }
  const parts = [];
  let cursor = 0;
  const matches = [];
  for (const match of text.matchAll(pathPattern)) {
    if (match.index === void 0) continue;
    matches.push({ index: match.index, value: match[0], source: "path" });
  }
  for (const match of text.matchAll(asciiFilenamePattern)) {
    if (match.index === void 0) continue;
    matches.push({ index: match.index, value: match[0], source: "ascii" });
  }
  for (const match of text.matchAll(cjkFilenamePattern)) {
    if (match.index === void 0 || !match[1]) continue;
    const valueStart = match.index + match[0].length - match[1].length;
    matches.push({ index: valueStart, value: match[1], source: "cjk" });
  }
  matches.sort((a, b) => a.index - b.index);
  for (const match of matches) {
    let value = match.value;
    const index = match.index;
    value = trimTrailingPunctuation(value);
    const prev = text[index - 1];
    const next = text[index + value.length];
    if (!isBoundaryChar(prev) || !isBoundaryChar(next)) {
      continue;
    }
    if (tokenHasUrlPrefix(text, index)) {
      continue;
    }
    if (!extensionHasLetter(value)) {
      continue;
    }
    if (index > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, index) });
    }
    parts.push({ type: "file", value });
    cursor = index + value.length;
  }
  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: text });
  }
  return parts;
}
function splitChildrenByFileMentions(children) {
  const parts = [];
  for (const child of children) {
    if (typeof child === "string") {
      const childParts = splitTextByFileMentions(child);
      parts.push(...childParts);
      continue;
    }
    if (child === null || child === void 0 || child === false) {
      continue;
    }
    parts.push({ type: "node", value: child });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: "" });
  }
  return parts;
}
function MessageCard({ message, isStreaming }) {
  const isUser = message.role === "user";
  const isQueued = message.localStatus === "queued";
  const isCancelled = message.localStatus === "cancelled";
  const rawContent = message.content;
  const contentBlocks = Array.isArray(rawContent) ? rawContent : [{ type: "text", text: String(rawContent ?? "") }];
  const [copied, setCopied] = useState(false);
  const getTextContent = () => {
    return contentBlocks.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  };
  const handleCopy = async () => {
    const text = getTextContent();
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "animate-fade-in", children: isUser ? (
    // User message - compact styling with smaller padding and radius
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 justify-end group", children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: `message-user px-4 py-2.5 max-w-[80%] break-words ${isQueued ? "opacity-70 border-dashed" : ""} ${isCancelled ? "opacity-60" : ""}`,
          children: [
            isQueued && /* @__PURE__ */ jsxs("div", { className: "mb-1 flex items-center gap-1 text-[11px] text-text-muted", children: [
              /* @__PURE__ */ jsx(Clock, { className: "w-3 h-3" }),
              /* @__PURE__ */ jsx("span", { children: "Queued" })
            ] }),
            isCancelled && /* @__PURE__ */ jsxs("div", { className: "mb-1 flex items-center gap-1 text-[11px] text-text-muted", children: [
              /* @__PURE__ */ jsx(XCircle, { className: "w-3 h-3" }),
              /* @__PURE__ */ jsx("span", { children: "Canceled" })
            ] }),
            contentBlocks.length === 0 ? /* @__PURE__ */ jsx("span", { className: "text-text-muted italic", children: "Empty message" }) : contentBlocks.map((block, index) => /* @__PURE__ */ jsx(
              ContentBlockView,
              {
                block,
                isUser,
                isStreaming
              },
              index
            ))
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleCopy,
          className: "mt-1 w-6 h-6 flex items-center justify-center rounded-md bg-surface-muted hover:bg-surface-active transition-all opacity-0 group-hover:opacity-100 flex-shrink-0",
          title: "Copy message",
          children: copied ? /* @__PURE__ */ jsx(Check, { className: "w-3 h-3 text-success" }) : /* @__PURE__ */ jsx(Copy, { className: "w-3 h-3 text-text-muted" })
        }
      )
    ] })
  ) : (
    // Assistant message
    /* @__PURE__ */ jsx("div", { className: "space-y-3", children: contentBlocks.map((block, index) => /* @__PURE__ */ jsx(
      ContentBlockView,
      {
        block,
        isUser,
        isStreaming,
        allBlocks: message.content,
        message
      },
      index
    )) })
  ) });
}
function ContentBlockView({ block, isUser, isStreaming, allBlocks, message }) {
  const { activeSessionId, sessions, workingDir } = useAppStore();
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;
  const currentWorkingDir = activeSession?.cwd || workingDir;
  const resolveFilePath = (value) => {
    if (/^(?:[A-Za-z]:\\|\\\\|\/)/.test(value)) {
      return value;
    }
    if (!currentWorkingDir) {
      return value;
    }
    return `${currentWorkingDir.replace(/[\\/]+$/, "")}/${value}`;
  };
  const renderFileButton = (value, key) => /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: () => {
        const resolved = resolveFilePath(value);
        if (navigator?.clipboard?.writeText) {
          void navigator.clipboard.writeText(resolved);
        }
      },
      className: getFileLinkButtonClassName(),
      title: "Copy file path",
      children: value
    },
    key
  );
  const renderFileMentionParts = (parts, keyPrefix) => parts.map((part, partIndex) => {
    const key = `${keyPrefix}-${partIndex}`;
    if (part.type === "file") {
      return renderFileButton(part.value, key);
    }
    if (part.type === "text") {
      return /* @__PURE__ */ jsx("span", { children: part.value }, key);
    }
    if (isValidElement(part.value)) {
      return part.value.key ? part.value : cloneElement(part.value, { key });
    }
    return /* @__PURE__ */ jsx("span", { children: String(part.value) }, key);
  });
  const renderChildrenWithFileLinks = (children, keyPrefix) => {
    const normalized = Array.isArray(children) ? children : [children];
    const parts = splitChildrenByFileMentions(normalized);
    return renderFileMentionParts(parts, keyPrefix);
  };
  switch (block.type) {
    case "text": {
      const textBlock = block;
      const text = textBlock.text || "";
      if (!text) {
        return /* @__PURE__ */ jsx("span", { className: "text-text-muted italic", children: "(empty text)" });
      }
      if (isUser) {
        return /* @__PURE__ */ jsxs("p", { className: "text-text-primary whitespace-pre-wrap break-words text-left", children: [
          text,
          isStreaming && /* @__PURE__ */ jsx("span", { className: "inline-block w-2 h-4 bg-accent ml-1 animate-pulse" })
        ] });
      }
      return /* @__PURE__ */ jsxs("div", { className: "prose-chat max-w-none text-text-primary", children: [
        /* @__PURE__ */ jsx(
          ReactMarkdown,
          {
            remarkPlugins: [remarkMath, remarkGfm],
            rehypePlugins: [rehypeKatex],
            components: {
              a({ children, href }) {
                return /* @__PURE__ */ jsx(
                  "a",
                  {
                    href,
                    target: "_blank",
                    rel: "noreferrer",
                    onClick: (event) => {
                      if (!href) {
                        return;
                      }
                      event.preventDefault();
                      window.open(href, "_blank", "noopener,noreferrer");
                    },
                    className: "text-accent hover:text-accent-hover",
                    children
                  }
                );
              },
              blockquote({ children }) {
                return /* @__PURE__ */ jsx("blockquote", { className: "border-l-2 border-accent/40 pl-4 text-text-muted", children });
              },
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match;
                if (isInline) {
                  const raw = String(children);
                  const parts = splitTextByFileMentions(raw);
                  if (parts.length === 1 && parts[0].type === "file") {
                    return renderFileButton(parts[0].value);
                  }
                  return /* @__PURE__ */ jsx("code", { className: "px-1.5 py-0.5 rounded bg-surface-muted text-accent font-mono text-sm", ...props, children });
                }
                return /* @__PURE__ */ jsx(CodeBlock, { language: match[1], children: String(children).replace(/\n$/, "") });
              },
              p({ children }) {
                return /* @__PURE__ */ jsx("p", { className: "text-left", children: renderChildrenWithFileLinks(children, "p") });
              },
              li({ children }) {
                return /* @__PURE__ */ jsx("li", { className: "text-left", children: renderChildrenWithFileLinks(children, "li") });
              },
              table({ children }) {
                return /* @__PURE__ */ jsx("div", { className: "overflow-x-auto my-3", children: /* @__PURE__ */ jsx("table", { className: "min-w-full border-collapse", children }) });
              },
              th({ children }) {
                return /* @__PURE__ */ jsx("th", { className: "border border-border px-3 py-2 text-left text-sm font-semibold text-text-primary bg-surface-muted", children });
              },
              td({ children }) {
                return /* @__PURE__ */ jsx("td", { className: "border border-border px-3 py-2 text-sm text-text-primary", children });
              },
              input({ checked, ...props }) {
                return /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked,
                    readOnly: true,
                    className: "mr-2 accent-accent",
                    ...props
                  }
                );
              },
              strong({ children }) {
                return /* @__PURE__ */ jsx("strong", { children: renderChildrenWithFileLinks(children, "strong") });
              },
              em({ children }) {
                return /* @__PURE__ */ jsx("em", { children: renderChildrenWithFileLinks(children, "em") });
              }
            },
            children: text
          }
        ),
        isStreaming && /* @__PURE__ */ jsx("span", { className: "inline-block w-2 h-4 bg-accent ml-1 animate-pulse" })
      ] });
    }
    case "image": {
      const imageBlock = block;
      const { source } = imageBlock;
      const imageSrc = `data:${source.media_type};base64,${source.data}`;
      return /* @__PURE__ */ jsx("div", { className: `${isUser ? "inline-block" : ""}`, children: /* @__PURE__ */ jsx(
        "img",
        {
          src: imageSrc,
          alt: "Pasted content",
          className: "w-full max-w-full rounded-lg border border-border",
          style: { maxHeight: "600px", objectFit: "contain" }
        }
      ) });
    }
    case "file_attachment": {
      const fileBlock = block;
      return /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-muted border border-border", children: [
        /* @__PURE__ */ jsx(FileText, { className: "w-4 h-4 text-accent flex-shrink-0" }),
        /* @__PURE__ */ jsx("div", { className: "flex-1 min-w-0", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-text-primary truncate", children: fileBlock.filename }) })
      ] });
    }
    case "tool_use":
      return /* @__PURE__ */ jsx(ToolUseBlock, { block });
    case "tool_result":
      return /* @__PURE__ */ jsx(ToolResultBlock, { block, allBlocks, message });
    case "thinking":
      return /* @__PURE__ */ jsx("div", { className: "text-sm text-text-muted italic", children: block.thinking });
    default:
      return null;
  }
}
function ToolUseBlock({ block }) {
  const { t: t2 } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (block.name === "AskUserQuestion") {
    return /* @__PURE__ */ jsx(AskUserQuestionBlock, { block });
  }
  if (block.name === "TodoWrite") {
    return /* @__PURE__ */ jsx(TodoWriteBlock, { block });
  }
  const getToolTitle = (name) => {
    if (name.startsWith("mcp__")) {
      const match = name.match(/^mcp__(.+?)__(.+)$/);
      if (match) {
        const toolName = match[2];
        return `Using ${toolName}`;
      }
      return `Using MCP tool`;
    }
    const titles = {
      "Bash": "Running command",
      "Read": "Reading file",
      "Write": "Writing file",
      "Edit": "Editing file",
      "Glob": "Searching files",
      "Grep": "Searching content",
      "WebFetch": "Fetching URL",
      "WebSearch": "Searching web",
      "TodoRead": "Reading todo list",
      "TodoWrite": "Updating todo list",
      "read_file": "Reading file",
      "write_file": "Writing file",
      "edit_file": "Editing file",
      "list_directory": "Listing directory",
      "glob": "Searching files",
      "grep": "Searching content",
      "execute_command": "Running command"
    };
    return titles[name] || `Using ${name}`;
  };
  const isMCPTool = block.name.startsWith("mcp__");
  const mcpServerName = isMCPTool ? block.name.match(/^mcp__(.+?)__/)?.[1] : null;
  return /* @__PURE__ */ jsxs("div", { className: `rounded-xl border overflow-hidden bg-surface ${isMCPTool ? "border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent" : "border-border"}`, children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setExpanded(!expanded),
        className: `w-full px-4 py-3 flex items-center gap-3 transition-colors ${isMCPTool ? "bg-purple-500/10 hover:bg-purple-500/20" : "bg-surface-muted hover:bg-surface-active"}`,
        children: [
          /* @__PURE__ */ jsx("div", { className: `w-6 h-6 rounded-lg flex items-center justify-center ${isMCPTool ? "bg-purple-500/20" : "bg-accent-muted"}`, children: isMCPTool ? /* @__PURE__ */ jsx(Plug, { className: "w-3.5 h-3.5 text-purple-500" }) : /* @__PURE__ */ jsx(Terminal, { className: "w-3.5 h-3.5 text-accent" }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 text-left", children: [
            /* @__PURE__ */ jsx("span", { className: "font-medium text-sm text-text-primary", children: getToolTitle(block.name) }),
            isMCPTool && mcpServerName && /* @__PURE__ */ jsx("span", { className: "ml-2 px-1.5 py-0.5 text-xs rounded bg-purple-500/20 text-purple-500", children: mcpServerName })
          ] }),
          expanded ? /* @__PURE__ */ jsx(ChevronDown, { className: "w-4 h-4 text-text-muted" }) : /* @__PURE__ */ jsx(ChevronRight, { className: "w-4 h-4 text-text-muted" })
        ]
      }
    ),
    expanded && /* @__PURE__ */ jsx("div", { className: "p-4 space-y-4 bg-surface", children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-text-muted mb-2", children: t2("messageCard.request") }),
      /* @__PURE__ */ jsx("pre", { className: "code-block text-xs", children: JSON.stringify(block.input, null, 2) })
    ] }) })
  ] });
}
function TodoWriteBlock({ block }) {
  const [expanded, setExpanded] = useState(true);
  const todos = block.input?.todos || [];
  const completedCount = todos.filter((t2) => t2.status === "completed").length;
  const totalCount = todos.length;
  const progress = totalCount > 0 ? completedCount / totalCount * 100 : 0;
  const inProgressItem = todos.find((t2) => t2.status === "in_progress");
  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return /* @__PURE__ */ jsx(CheckSquare, { className: "w-4 h-4 text-success" });
      case "in_progress":
        return /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 text-accent animate-spin" });
      case "cancelled":
        return /* @__PURE__ */ jsx(XCircle, { className: "w-4 h-4 text-text-muted" });
      default:
        return /* @__PURE__ */ jsx(Square, { className: "w-4 h-4 text-text-muted" });
    }
  };
  const getStatusStyle = (status) => {
    switch (status) {
      case "completed":
        return "text-text-muted line-through";
      case "in_progress":
        return "text-accent font-medium";
      case "cancelled":
        return "text-text-muted line-through opacity-60";
      default:
        return "text-text-primary";
    }
  };
  if (todos.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-border overflow-hidden bg-surface", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setExpanded(!expanded),
        className: "w-full px-4 py-3 flex items-center gap-3 bg-surface-muted hover:bg-surface-active transition-colors",
        children: [
          /* @__PURE__ */ jsx("div", { className: "w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center", children: /* @__PURE__ */ jsx(ListTodo, { className: "w-3.5 h-3.5 text-blue-500" }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 text-left", children: [
            /* @__PURE__ */ jsx("span", { className: "font-medium text-sm text-text-primary", children: "Task Progress" }),
            inProgressItem && /* @__PURE__ */ jsxs("span", { className: "text-xs text-text-muted ml-2", children: [
              "— ",
              inProgressItem.activeForm || inProgressItem.content
            ] })
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-xs font-medium text-text-muted mr-2", children: [
            completedCount,
            "/",
            totalCount
          ] }),
          expanded ? /* @__PURE__ */ jsx(ChevronDown, { className: "w-4 h-4 text-text-muted" }) : /* @__PURE__ */ jsx(ChevronRight, { className: "w-4 h-4 text-text-muted" })
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "h-0.5 bg-surface-muted", children: /* @__PURE__ */ jsx(
      "div",
      {
        className: "h-full bg-gradient-to-r from-blue-500 to-accent transition-all duration-500",
        style: { width: `${progress}%` }
      }
    ) }),
    expanded && /* @__PURE__ */ jsx("div", { className: "p-3 space-y-1", children: todos.map((todo, index) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: `flex items-start gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${todo.status === "in_progress" ? "bg-accent/5" : ""}`,
        children: [
          /* @__PURE__ */ jsx("div", { className: "mt-0.5 flex-shrink-0", children: getStatusIcon(todo.status) }),
          /* @__PURE__ */ jsx("span", { className: `text-sm leading-relaxed ${getStatusStyle(todo.status)}`, children: todo.content })
        ]
      },
      todo.id || index
    )) })
  ] });
}
function AskUserQuestionBlock({ block }) {
  const { respondToQuestion } = useIPC();
  const { pendingQuestion } = useAppStore();
  const [selections, setSelections] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const questions = block.input?.questions || [];
  const isPending = pendingQuestion?.toolUseId === block.id;
  const isAnswered = submitted || !isPending;
  const handleOptionToggle = (questionIdx, label, multiSelect) => {
    if (isAnswered) return;
    setSelections((prev) => {
      const current = prev[questionIdx] || [];
      if (multiSelect) {
        if (current.includes(label)) {
          return { ...prev, [questionIdx]: current.filter((l) => l !== label) };
        } else {
          return { ...prev, [questionIdx]: [...current, label] };
        }
      } else {
        return { ...prev, [questionIdx]: [label] };
      }
    });
  };
  const handleSubmit = () => {
    if (!pendingQuestion || submitted) return;
    const answersJson = JSON.stringify(selections);
    console.log("[AskUserQuestionBlock] Submitting answer:", answersJson);
    respondToQuestion(pendingQuestion.questionId, answersJson);
    setSubmitted(true);
  };
  const canSubmit = isPending && !submitted && questions.every((q, idx) => {
    if (q.options && q.options.length > 0) {
      return (selections[idx] || []).length > 0;
    }
    return true;
  });
  const getOptionLetter = (index) => String.fromCharCode(65 + index);
  if (questions.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border bg-surface p-4", children: /* @__PURE__ */ jsx("span", { className: "text-text-muted", children: "No questions" }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "px-4 py-3 bg-accent/10 border-b border-accent/20 flex items-center gap-3", children: [
      /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center", children: /* @__PURE__ */ jsx(HelpCircle, { className: "w-4 h-4 text-accent" }) }),
      /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("span", { className: "font-medium text-sm text-text-primary", children: isAnswered ? "Questions answered" : "Please answer to continue" }) }),
      isAnswered && /* @__PURE__ */ jsx(CheckCircle2, { className: "w-5 h-5 text-success ml-auto" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "p-4 space-y-5", children: questions.map((q, qIdx) => /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      q.header && /* @__PURE__ */ jsx("span", { className: "inline-block px-2 py-0.5 bg-accent/10 text-accent text-xs font-semibold rounded uppercase tracking-wide", children: q.header }),
      /* @__PURE__ */ jsx("p", { className: "text-text-primary font-medium text-sm", children: q.question }),
      q.options && q.options.length > 0 && /* @__PURE__ */ jsx("div", { className: "space-y-1.5 mt-2", children: q.options.map((option, optIdx) => {
        const isSelected = (selections[qIdx] || []).includes(option.label);
        const letter = getOptionLetter(optIdx);
        return /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => handleOptionToggle(qIdx, option.label, q.multiSelect || false),
            disabled: isAnswered,
            className: `w-full p-3 rounded-lg border text-left transition-all ${isAnswered ? isSelected ? "border-accent/50 bg-accent/10 cursor-default" : "border-border-subtle bg-surface-muted cursor-default opacity-60" : isSelected ? "border-accent bg-accent/10 hover:bg-accent/15" : "border-border-subtle bg-surface hover:border-border-default hover:bg-surface-muted"}`,
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2.5", children: [
              /* @__PURE__ */ jsx("div", { className: `w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs font-semibold ${isSelected ? "bg-accent text-white" : "bg-border-subtle text-text-secondary"}`, children: isSelected ? /* @__PURE__ */ jsx(Check, { className: "w-3.5 h-3.5" }) : letter }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("span", { className: `text-sm ${isSelected ? "text-accent font-medium" : "text-text-primary"}`, children: option.label }),
                option.description && /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted mt-0.5", children: option.description })
              ] })
            ] })
          },
          optIdx
        );
      }) })
    ] }, qIdx)) }),
    isPending && !submitted && /* @__PURE__ */ jsx("div", { className: "px-4 pb-4", children: /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: handleSubmit,
        disabled: !canSubmit,
        className: `w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${canSubmit ? "bg-accent text-white hover:bg-accent-hover" : "bg-surface-muted text-text-muted cursor-not-allowed"}`,
        children: [
          /* @__PURE__ */ jsx(Send, { className: "w-4 h-4" }),
          "Submit Answers"
        ]
      }
    ) })
  ] });
}
function ToolResultBlock({ block, allBlocks, message }) {
  const { traceStepsBySession } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  let toolName;
  if (message?.sessionId) {
    const steps = traceStepsBySession[message.sessionId] || [];
    const toolCallStep = steps.find((s) => s.id === block.toolUseId && s.type === "tool_call");
    if (toolCallStep) {
      toolName = toolCallStep.toolName;
    }
  }
  if (!toolName) {
    const toolUseBlock = allBlocks?.find(
      (b) => b.type === "tool_use" && b.id === block.toolUseId
    );
    toolName = toolUseBlock?.name;
  }
  const isMCPTool = toolName?.startsWith("mcp__") || false;
  console.log("[ToolResultBlock] toolUseId:", block.toolUseId, "toolName:", toolName, "isMCPTool:", isMCPTool, "expanded:", expanded);
  const generateSummary = (content, isError) => {
    if (isError) {
      if (content.includes("Could not connect to Chrome")) {
        return "✗ Chrome not connected";
      }
      if (content.includes("ECONNREFUSED")) {
        return "✗ Connection refused";
      }
      if (content.includes("timeout")) {
        return "✗ Operation timed out";
      }
      const firstLine2 = content.split("\n")[0];
      return `✗ ${firstLine2.substring(0, 60)}${firstLine2.length > 60 ? "..." : ""}`;
    }
    if (content.includes("Successfully navigated to")) {
      const urlMatch = content.match(/Successfully navigated to (.+)/);
      if (urlMatch) {
        const url = urlMatch[1].trim();
        return `✓ Navigated to ${url.length > 50 ? url.substring(0, 50) + "..." : url}`;
      }
      return "✓ Navigation successful";
    }
    if (content.includes("Page created")) {
      return "✓ New page created";
    }
    if (content.includes("Screenshot saved") || content.includes("screenshot")) {
      return "✓ Screenshot captured";
    }
    if (content.includes("Successfully clicked")) {
      return "✓ Element clicked";
    }
    if (content.includes("Successfully typed")) {
      const textMatch = content.match(/Successfully typed "(.+?)"/);
      if (textMatch) {
        const text = textMatch[1];
        return `✓ Typed: ${text.length > 30 ? text.substring(0, 30) + "..." : text}`;
      }
      return "✓ Text entered";
    }
    if (content.includes('"title"') && content.includes('"url"')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return `✓ Found ${parsed.length} open page${parsed.length !== 1 ? "s" : ""}`;
        }
      } catch (e) {
      }
    }
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return `✓ Returned ${parsed.length} item${parsed.length !== 1 ? "s" : ""}`;
        }
        if (typeof parsed === "object") {
          const keys = Object.keys(parsed);
          if (keys.length <= 3) {
            return `✓ Success (${keys.join(", ")})`;
          }
          return `✓ Success (${keys.length} fields)`;
        }
      } catch (e) {
      }
    }
    const lines = content.trim().split("\n");
    if (lines.length === 1 && lines[0].length < 80) {
      return `✓ ${lines[0]}`;
    }
    if (content.length < 100) {
      return `✓ ${content.trim()}`;
    }
    const firstLine = lines[0].trim();
    if (firstLine.length > 0 && firstLine.length < 60) {
      return `✓ ${firstLine}`;
    }
    return `✓ Success (${content.length} chars, ${lines.length} lines)`;
  };
  const summary = generateSummary(block.content, block.isError || false);
  const hasImages = block.images && block.images.length > 0;
  console.log("[ToolResultBlock] Full block:", {
    toolUseId: block.toolUseId,
    hasImages,
    imagesCount: block.images?.length || 0,
    contentLength: block.content?.length || 0,
    imagesMimeTypes: block.images?.map((img) => img.mimeType),
    imagesDataLengths: block.images?.map((img) => img.data?.length || 0)
  });
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-border overflow-hidden bg-surface", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setExpanded(!expanded),
        className: `w-full px-4 py-3 flex items-center gap-3 transition-colors ${block.isError ? "bg-error/10 hover:bg-error/20" : "bg-success/10 hover:bg-success/20"}`,
        children: [
          block.isError ? /* @__PURE__ */ jsx(AlertCircle, { className: "w-5 h-5 text-error" }) : /* @__PURE__ */ jsx(CheckCircle2, { className: "w-5 h-5 text-success" }),
          /* @__PURE__ */ jsxs("span", { className: `font-medium text-sm flex-1 text-left ${block.isError ? "text-error" : "text-success"}`, children: [
            summary,
            hasImages && block.images && /* @__PURE__ */ jsxs("span", { className: "ml-2 text-xs text-text-muted", children: [
              "📸 ",
              block.images.length,
              " image",
              block.images.length > 1 ? "s" : ""
            ] })
          ] }),
          expanded ? /* @__PURE__ */ jsx(ChevronDown, { className: "w-4 h-4 text-text-muted" }) : /* @__PURE__ */ jsx(ChevronRight, { className: "w-4 h-4 text-text-muted" })
        ]
      }
    ),
    expanded && /* @__PURE__ */ jsxs("div", { className: "p-4 bg-surface space-y-4", children: [
      /* @__PURE__ */ jsx("pre", { className: "code-block text-xs whitespace-pre-wrap font-mono", children: block.content }),
      block.images && block.images.length > 0 && /* @__PURE__ */ jsx("div", { className: "space-y-3", children: block.images.map((image, index) => /* @__PURE__ */ jsx("div", { className: "border border-border rounded-lg overflow-hidden", children: /* @__PURE__ */ jsx(
        "img",
        {
          src: `data:${image.mimeType};base64,${image.data}`,
          alt: `Screenshot ${index + 1}`,
          className: "w-full h-auto",
          style: { maxHeight: "600px", objectFit: "contain" }
        }
      ) }, index)) })
    ] })
  ] });
}
function CodeBlock({ language: language2, children }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return /* @__PURE__ */ jsxs("div", { className: "relative group my-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity", children: [
      /* @__PURE__ */ jsx("span", { className: "text-xs text-text-muted px-2 py-1 rounded bg-surface", children: language2 }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleCopy,
          className: "w-7 h-7 flex items-center justify-center rounded bg-surface hover:bg-surface-hover transition-colors",
          children: copied ? /* @__PURE__ */ jsx(Check, { className: "w-3.5 h-3.5 text-success" }) : /* @__PURE__ */ jsx(Copy, { className: "w-3.5 h-3.5 text-text-muted" })
        }
      )
    ] }),
    /* @__PURE__ */ jsx("pre", { className: "code-block", children: /* @__PURE__ */ jsx("code", { children }) })
  ] });
}
function ChatView() {
  const { t: t2 } = useTranslation();
  const {
    activeSessionId,
    sessions,
    messagesBySession,
    partialMessagesBySession,
    activeTurnsBySession,
    pendingTurnsBySession,
    appConfig,
    activeProjectId,
    activeCollectionByProject,
    setProjectActiveCollection
  } = useAppStore();
  const { continueSession, stopSession } = useIPC();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeConnectors, setActiveConnectors] = useState([]);
  const [showConnectorLabel, setShowConnectorLabel] = useState(true);
  const [deepResearchBySession, setDeepResearchBySession] = useState({});
  const [projectCollections, setProjectCollections] = useState([]);
  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const connectorMeasureRef = useRef(null);
  const [pastedImages, setPastedImages] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isUserAtBottomRef = useRef(true);
  const isComposingRef = useRef(false);
  const textareaRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const prevPartialLengthRef = useRef(0);
  const scrollTimeoutRef = useRef(null);
  const scrollRequestRef = useRef(null);
  const isScrollingRef = useRef(false);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSessionId ? messagesBySession[activeSessionId] || [] : [];
  const pendingTurns = activeSessionId ? pendingTurnsBySession[activeSessionId] || [] : [];
  const partialMessage = activeSessionId ? partialMessagesBySession[activeSessionId] || "" : "";
  const deepResearchEnabled = activeSessionId ? Boolean(deepResearchBySession[activeSessionId]) : false;
  const activeTurn = activeSessionId ? activeTurnsBySession[activeSessionId] : null;
  const hasActiveTurn = Boolean(activeTurn);
  const pendingCount = pendingTurns.length;
  const canStop = hasActiveTurn || pendingCount > 0;
  const displayedMessages = useMemo(() => {
    if (!activeSessionId) return messages;
    if (!partialMessage || !activeTurn?.userMessageId) return messages;
    const anchorIndex = messages.findIndex((message) => message.id === activeTurn.userMessageId);
    if (anchorIndex === -1) return messages;
    let insertIndex = anchorIndex + 1;
    while (insertIndex < messages.length) {
      if (messages[insertIndex].role === "user") break;
      insertIndex += 1;
    }
    const streamingMessage = {
      id: `partial-${activeSessionId}`,
      sessionId: activeSessionId,
      role: "assistant",
      content: [{ type: "text", text: partialMessage }],
      timestamp: Date.now()
    };
    return [
      ...messages.slice(0, insertIndex),
      streamingMessage,
      ...messages.slice(insertIndex)
    ];
  }, [activeSessionId, activeTurn?.userMessageId, messages, partialMessage]);
  const scrollToBottom = useRef((behavior = "auto", immediate = false) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    if (scrollRequestRef.current) {
      cancelAnimationFrame(scrollRequestRef.current);
      scrollRequestRef.current = null;
    }
    const performScroll = () => {
      if (!isUserAtBottomRef.current) return;
      isScrollingRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior });
      setTimeout(() => {
        isScrollingRef.current = false;
      }, behavior === "smooth" ? 300 : 50);
    };
    if (immediate) {
      performScroll();
    } else {
      scrollRequestRef.current = requestAnimationFrame(() => {
        scrollTimeoutRef.current = setTimeout(performScroll, 16);
      });
    }
  }).current;
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const updateScrollState = () => {
      const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      isUserAtBottomRef.current = distanceToBottom <= 80;
    };
    updateScrollState();
    const onScroll = () => updateScrollState();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const loadCollections = async () => {
      if (!activeProjectId) {
        setProjectCollections([]);
        return;
      }
      try {
        const next = await headlessGetCollections(activeProjectId);
        setProjectCollections(next);
        if (!activeCollectionByProject[activeProjectId] && next[0]) {
          setProjectActiveCollection(activeProjectId, next[0].id);
        }
      } catch {
        setProjectCollections([]);
      }
    };
    void loadCollections();
  }, [activeProjectId, activeCollectionByProject, setProjectActiveCollection]);
  useEffect(() => {
    const messageCount = messages.length;
    const partialLength = partialMessage.length;
    const hasNewMessage = messageCount !== prevMessageCountRef.current;
    const isStreamingTick = partialLength !== prevPartialLengthRef.current && !hasNewMessage;
    if (isScrollingRef.current) {
      prevMessageCountRef.current = messageCount;
      prevPartialLengthRef.current = partialLength;
      return;
    }
    if (isUserAtBottomRef.current) {
      if (!isStreamingTick) {
        const behavior = hasNewMessage ? "smooth" : "auto";
        scrollToBottom(behavior, false);
      } else {
        scrollToBottom("auto", false);
      }
    }
    prevMessageCountRef.current = messageCount;
    prevPartialLengthRef.current = partialLength;
  }, [messages.length, partialMessage]);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const messagesContainer = container.querySelector(".max-w-3xl");
    if (!messagesContainer) return;
    const resizeObserver = new ResizeObserver(() => {
      if (!isScrollingRef.current && isUserAtBottomRef.current) {
        scrollToBottom("auto", false);
      }
    });
    resizeObserver.observe(messagesContainer);
    return () => {
      resizeObserver.disconnect();
    };
  }, [displayedMessages]);
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollRequestRef.current) {
        cancelAnimationFrame(scrollRequestRef.current);
      }
    };
  }, []);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeSessionId]);
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const newImages = [];
    for (const item of imageItems) {
      const blob = item.getAsFile();
      if (!blob) continue;
      try {
        const resizedBlob = await resizeImageIfNeeded(blob);
        const base64 = await blobToBase64(resizedBlob);
        const url = URL.createObjectURL(resizedBlob);
        newImages.push({
          url,
          base64,
          mediaType: resizedBlob.type
        });
      } catch (err) {
        console.error("Failed to process pasted image:", err);
      }
    }
    setPastedImages((prev) => [...prev, ...newImages]);
  };
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  const resizeImageIfNeeded = async (blob) => {
    const MAX_BLOB_SIZE = 3.75 * 1024 * 1024;
    if (blob.size <= MAX_BLOB_SIZE) {
      return blob;
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        let scale = Math.sqrt(MAX_BLOB_SIZE / blob.size);
        let quality = 0.9;
        const attemptCompress = (currentScale, currentQuality) => {
          canvas.width = Math.floor(img.width * currentScale);
          canvas.height = Math.floor(img.height * currentScale);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return new Promise((resolveBlob) => {
            canvas.toBlob(
              (compressedBlob) => {
                if (!compressedBlob) {
                  reject(new Error("Failed to compress image"));
                  return;
                }
                if (compressedBlob.size > MAX_BLOB_SIZE && (currentQuality > 0.5 || currentScale > 0.3)) {
                  const newQuality = Math.max(0.5, currentQuality - 0.1);
                  const newScale = currentQuality <= 0.5 ? currentScale * 0.9 : currentScale;
                  attemptCompress(newScale, newQuality).then(resolveBlob);
                } else {
                  resolveBlob(compressedBlob);
                }
              },
              blob.type || "image/jpeg",
              currentQuality
            );
          });
        };
        attemptCompress(scale, quality).then(resolve).catch(reject);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  };
  const removeImage = (index) => {
    setPastedImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  };
  const removeFile = (index) => {
    setAttachedFiles((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };
  const handleFileSelect = async () => {
    try {
      const picker = document.createElement("input");
      picker.type = "file";
      picker.multiple = true;
      picker.onchange = () => {
        const files = Array.from(picker.files || []);
        if (!files.length) return;
        const newFiles = files.map((file) => {
          const fileName = file.name || "unknown";
          return {
            name: fileName,
            path: "",
            size: file.size || 0,
            type: file.type || "application/octet-stream"
          };
        });
        setAttachedFiles((prev) => [...prev, ...newFiles]);
      };
      picker.click();
    } catch (error) {
      console.error("[ChatView] Error selecting files:", error);
    }
  };
  useEffect(() => {
    const loadConnectors = async () => {
      try {
        const statuses = await headlessGetMcpServerStatus();
        const active = statuses?.filter((s) => s.connected && s.toolCount > 0) || [];
        setActiveConnectors(active);
      } catch (err) {
        console.error("Failed to load MCP connectors:", err);
      }
    };
    void loadConnectors();
    const interval = setInterval(() => {
      void loadConnectors();
    }, 5e3);
    return () => clearInterval(interval);
  }, []);
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const otherFiles = files.filter((file) => !file.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      const newImages = [];
      for (const file of imageFiles) {
        try {
          const resizedBlob = await resizeImageIfNeeded(file);
          const base64 = await blobToBase64(resizedBlob);
          const url = URL.createObjectURL(resizedBlob);
          newImages.push({
            url,
            base64,
            mediaType: resizedBlob.type
          });
        } catch (err) {
          console.error("Failed to process dropped image:", err);
        }
      }
      setPastedImages((prev) => [...prev, ...newImages]);
    }
    if (otherFiles.length > 0) {
      const newFiles = otherFiles.map((file) => ({
        name: file.name,
        path: "",
        size: file.size,
        type: file.type || "application/octet-stream"
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
  };
  useEffect(() => {
    const titleEl = titleRef.current;
    const headerEl = headerRef.current;
    const measureEl = connectorMeasureRef.current;
    if (!titleEl || !headerEl || !measureEl) {
      setShowConnectorLabel(true);
      return;
    }
    const updateLabelVisibility = () => {
      const isTruncated = titleEl.scrollWidth > titleEl.clientWidth;
      const headerStyle = window.getComputedStyle(headerEl);
      const paddingLeft = Number.parseFloat(headerStyle.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(headerStyle.paddingRight) || 0;
      const contentWidth = headerEl.clientWidth - paddingLeft - paddingRight;
      const titleWidth = titleEl.getBoundingClientRect().width;
      const rightColumnWidth = Math.max(0, (contentWidth - titleWidth) / 2);
      const connectorFullWidth = measureEl.getBoundingClientRect().width;
      setShowConnectorLabel(!isTruncated && rightColumnWidth >= connectorFullWidth);
    };
    updateLabelVisibility();
    const observer = new ResizeObserver(() => {
      updateLabelVisibility();
    });
    observer.observe(titleEl);
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, [activeSession?.title, activeConnectors.length]);
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const currentPrompt = textareaRef.current?.value || prompt;
    if (!currentPrompt.trim() && pastedImages.length === 0 && attachedFiles.length === 0 || !activeSessionId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const contentBlocks = [];
      pastedImages.forEach((img) => {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mediaType,
            data: img.base64
          }
        });
      });
      attachedFiles.forEach((file) => {
        contentBlocks.push({
          type: "file_attachment",
          filename: file.name,
          relativePath: file.path,
          // Will be processed by backend to copy to .tmp
          size: file.size,
          mimeType: file.type
        });
      });
      if (currentPrompt.trim()) {
        contentBlocks.push({
          type: "text",
          text: currentPrompt.trim()
        });
      }
      await continueSession(activeSessionId, contentBlocks, { deepResearch: deepResearchEnabled });
      setPrompt("");
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }
      pastedImages.forEach((img) => URL.revokeObjectURL(img.url));
      setPastedImages([]);
      setAttachedFiles([]);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleStop = () => {
    if (activeSessionId) {
      stopSession(activeSessionId);
    }
  };
  if (!activeSession) {
    return /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center text-text-muted", children: /* @__PURE__ */ jsx("span", { children: t2("chat.loadingConversation") }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref: headerRef,
        className: "relative h-14 border-b border-border grid grid-cols-[1fr_auto_1fr] items-center px-6 bg-surface/80 backdrop-blur-sm",
        children: [
          /* @__PURE__ */ jsx("div", {}),
          /* @__PURE__ */ jsx("h2", { ref: titleRef, className: "font-medium text-text-primary text-center truncate max-w-lg", children: activeSession.title }),
          activeConnectors.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                ref: connectorMeasureRef,
                "aria-hidden": "true",
                className: "absolute left-0 top-0 -z-10 opacity-0 pointer-events-none",
                children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-2 py-1 rounded-lg border border-purple-500/20", children: [
                  /* @__PURE__ */ jsx(Plug, { className: "w-3.5 h-3.5" }),
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-medium whitespace-nowrap", children: t2("chat.connectorCount", { count: activeConnectors.length }) })
                ] })
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 justify-self-end", children: [
              /* @__PURE__ */ jsx(Plug, { className: "w-3.5 h-3.5 text-purple-500" }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-purple-500 font-medium", children: showConnectorLabel ? t2("chat.connectorCount", { count: activeConnectors.length }) : activeConnectors.length })
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { ref: scrollContainerRef, className: "flex-1 overflow-y-auto", children: /* @__PURE__ */ jsxs("div", { className: "max-w-3xl mx-auto py-6 px-4 space-y-4", children: [
      displayedMessages.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-12 text-text-muted", children: /* @__PURE__ */ jsx("p", { children: t2("chat.startConversation") }) }) : displayedMessages.map((message) => {
        const isStreaming = typeof message.id === "string" && message.id.startsWith("partial-");
        return /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(MessageCard, { message, isStreaming }) }, message.id);
      }),
      hasActiveTurn && (!partialMessage || partialMessage.trim() === "") && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-border max-w-fit", children: [
        /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 text-accent animate-spin" }),
        /* @__PURE__ */ jsx("span", { className: "text-sm text-text-secondary", children: t2("chat.processing") })
      ] }),
      /* @__PURE__ */ jsx("div", { ref: messagesEndRef })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "border-t border-border bg-surface/80 backdrop-blur-sm", children: /* @__PURE__ */ jsx("div", { className: "px-4 py-4", children: /* @__PURE__ */ jsxs(
      "form",
      {
        onSubmit: handleSubmit,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        className: "relative w-full",
        children: [
          pastedImages.length > 0 && /* @__PURE__ */ jsx("div", { className: "grid grid-cols-5 gap-2 mb-3", children: pastedImages.map((img, index) => /* @__PURE__ */ jsxs("div", { className: "relative group", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: img.url,
                alt: `Pasted ${index + 1}`,
                className: "w-full aspect-square object-cover rounded-lg border border-border block"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => removeImage(index),
                className: "absolute -top-1 -right-1 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                children: /* @__PURE__ */ jsx(X, { className: "w-3 h-3" })
              }
            )
          ] }, index)) }),
          attachedFiles.length > 0 && /* @__PURE__ */ jsx("div", { className: "space-y-2 mb-3", children: attachedFiles.map((file, index) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-muted border border-border group",
              children: [
                /* @__PURE__ */ jsx("div", { className: "flex-1 min-w-0", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-text-primary truncate", children: file.name }) }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => removeFile(index),
                    className: "w-6 h-6 rounded-full bg-error/10 hover:bg-error/20 text-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                    children: /* @__PURE__ */ jsx(X, { className: "w-3.5 h-3.5" })
                  }
                )
              ]
            },
            index
          )) }),
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: `flex items-end gap-2 p-3 rounded-3xl bg-surface transition-colors ${isDragging ? "ring-2 ring-accent bg-accent/5" : ""}`,
              style: { border: "1px solid rgba(255, 255, 255, 0.1)" },
              children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: handleFileSelect,
                    className: "w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors",
                    title: t2("welcome.attachFiles"),
                    children: /* @__PURE__ */ jsx(Plus, { className: "w-5 h-5" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "textarea",
                  {
                    ref: textareaRef,
                    value: prompt,
                    onChange: (e) => setPrompt(e.target.value),
                    onCompositionStart: () => {
                      isComposingRef.current = true;
                    },
                    onCompositionEnd: () => {
                      isComposingRef.current = false;
                    },
                    onPaste: handlePaste,
                    onKeyDown: (e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        if (e.nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229) {
                          return;
                        }
                        e.preventDefault();
                        handleSubmit();
                      }
                    },
                    placeholder: t2("chat.typeMessage"),
                    disabled: isSubmitting,
                    rows: 1,
                    className: "flex-1 resize-none bg-transparent border-none outline-none text-text-primary placeholder:text-text-muted text-sm py-1.5"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "px-2 py-1 text-xs text-text-muted", children: appConfig?.model || "No model" }),
                  activeSessionId && /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => setDeepResearchBySession((prev) => ({
                        ...prev,
                        [activeSessionId]: !deepResearchEnabled
                      })),
                      className: `text-xs px-2 py-1 rounded border flex items-center gap-1 ${deepResearchEnabled ? "bg-accent/10 border-accent/40 text-accent" : "bg-surface-muted border-border text-text-muted"}`,
                      title: "Enable deeper multi-step web research for this task",
                      children: [
                        /* @__PURE__ */ jsx(FlaskConical, { className: "w-3.5 h-3.5" }),
                        /* @__PURE__ */ jsx("span", { children: "Deep Research" })
                      ]
                    }
                  ),
                  activeProjectId && projectCollections.length > 0 && /* @__PURE__ */ jsx(
                    "select",
                    {
                      className: "text-xs bg-surface-muted border border-border rounded px-2 py-1 max-w-[180px]",
                      value: activeCollectionByProject[activeProjectId] || projectCollections[0].id,
                      onChange: (e) => setProjectActiveCollection(activeProjectId, e.target.value),
                      title: "Active collection for task source capture",
                      children: projectCollections.map((collection) => /* @__PURE__ */ jsx("option", { value: collection.id, children: collection.name }, collection.id))
                    }
                  ),
                  canStop && /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: handleStop,
                      className: "w-8 h-8 rounded-lg flex items-center justify-center bg-error/10 text-error hover:bg-error/20 transition-colors",
                      children: /* @__PURE__ */ jsx(Square, { className: "w-4 h-4" })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "submit",
                      disabled: !prompt.trim() && !textareaRef.current?.value.trim() && pastedImages.length === 0 && attachedFiles.length === 0 || isSubmitting,
                      className: "w-8 h-8 rounded-lg flex items-center justify-center bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors",
                      children: /* @__PURE__ */ jsx(Send, { className: "w-4 h-4" })
                    }
                  )
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted text-center mt-2", children: "Open Analyst is AI-powered and may make mistakes. Please double-check responses." }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-amber-600 text-center mt-1", children: "Headless mode uses the API service on port 8787 for tools and execution." })
        ]
      }
    ) }) })
  ] });
}
function ProjectWorkspace({ onActiveProjectChange, fixedProjectId = null, showProjectColumn = true }) {
  const activeCollectionByProject = useAppStore((state) => state.activeCollectionByProject);
  const setProjectActiveCollection = useAppStore((state) => state.setProjectActiveCollection);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [collections, setCollections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshProjects = useCallback(async () => {
    if (fixedProjectId) {
      setActiveProjectId(fixedProjectId);
      onActiveProjectChange?.(fixedProjectId);
      return fixedProjectId;
    }
    const payload = await headlessGetProjects();
    setProjects(payload.projects);
    setActiveProjectId(payload.activeProject?.id || null);
    onActiveProjectChange?.(payload.activeProject?.id || null);
    return payload.activeProject?.id || null;
  }, [onActiveProjectChange, fixedProjectId]);
  const refreshProjectData = useCallback(async (projectId) => {
    const [nextCollections, nextDocuments, nextRuns] = await Promise.all([
      headlessGetCollections(projectId),
      headlessGetDocuments(projectId),
      headlessGetRuns(projectId)
    ]);
    setCollections(nextCollections);
    setDocuments(nextDocuments);
    setRuns(nextRuns);
    const remembered = activeCollectionByProject[projectId] || "";
    if (remembered && nextCollections.some((item) => item.id === remembered)) {
      setSelectedCollectionId(remembered);
      return;
    }
    if (!selectedCollectionId && nextCollections.length > 0) {
      setSelectedCollectionId(nextCollections[0].id);
      setProjectActiveCollection(projectId, nextCollections[0].id);
    }
  }, [selectedCollectionId, activeCollectionByProject, setProjectActiveCollection]);
  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectId = await refreshProjects();
      if (projectId) {
        await refreshProjectData(projectId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [refreshProjects, refreshProjectData]);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (!activeProjectId) return;
    const timer = setInterval(() => {
      void refreshProjectData(activeProjectId);
    }, 4e3);
    return () => clearInterval(timer);
  }, [activeProjectId, refreshProjectData]);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );
  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) || null,
    [documents, selectedDocumentId]
  );
  const handleSetActiveProject = async (projectId) => {
    setError(null);
    try {
      await headlessSetActiveProject(projectId);
      setActiveProjectId(projectId);
      onActiveProjectChange?.(projectId);
      await refreshProjectData(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleRefreshWorkspace = async () => {
    if (!activeProjectId) return;
    setError(null);
    try {
      await refreshProjectData(activeProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleCreateProject = async () => {
    const name = projectName.trim();
    if (!name) return;
    setError(null);
    try {
      const project = await headlessCreateProject(name);
      setProjectName("");
      await refreshProjects();
      await handleSetActiveProject(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleCreateCollection = async () => {
    if (!activeProjectId) return;
    const name = collectionName.trim();
    if (!name) return;
    setError(null);
    try {
      const created = await headlessCreateCollection(activeProjectId, name);
      setCollectionName("");
      setCollections((prev) => [created, ...prev]);
      setSelectedCollectionId(created.id);
      setProjectActiveCollection(activeProjectId, created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleCreateManualSource = async () => {
    if (!activeProjectId) return;
    const title = sourceTitle.trim();
    const content = sourceContent.trim();
    if (!title || !content) return;
    setError(null);
    try {
      const doc = await headlessCreateDocument(activeProjectId, {
        collectionId: selectedCollectionId || void 0,
        title,
        content
      });
      setDocuments((prev) => [doc, ...prev]);
      setSelectedDocumentId(doc.id);
      setSourceTitle("");
      setSourceContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleImportUrl = async () => {
    if (!activeProjectId) return;
    const url = sourceUrl.trim();
    if (!url) return;
    setError(null);
    try {
      const doc = await headlessImportUrl(activeProjectId, url, selectedCollectionId || void 0);
      setDocuments((prev) => [doc, ...prev]);
      setSelectedDocumentId(doc.id);
      setSourceUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleImportFiles = async (event) => {
    if (!activeProjectId) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setError(null);
    setUploading(true);
    try {
      const imported = [];
      for (const file of files) {
        const doc = await headlessImportFile(activeProjectId, file, selectedCollectionId || void 0);
        imported.push(doc);
      }
      setDocuments((prev) => [...imported, ...prev]);
      if (imported[0]) setSelectedDocumentId(imported[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };
  const handleRagSearch = async () => {
    if (!activeProjectId) return;
    const query = ragQuery.trim();
    if (!query) return;
    setError(null);
    try {
      const response = await headlessRagQuery(activeProjectId, query, selectedCollectionId || void 0);
      setRagResults(response.results);
      await refreshProjectData(activeProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-12 gap-4", children: [
    showProjectColumn && /* @__PURE__ */ jsxs("section", { className: "card p-4 xl:col-span-3 space-y-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Database, { className: "w-4 h-4 text-accent" }),
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold", children: "Projects" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "input text-sm py-2",
            placeholder: "New project name",
            value: projectName,
            onChange: (event) => setProjectName(event.target.value)
          }
        ),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary px-3", onClick: handleCreateProject, title: "Create project", children: /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "space-y-2 max-h-[280px] overflow-y-auto pr-1", children: projects.map((project) => /* @__PURE__ */ jsxs(
        "button",
        {
          className: `w-full text-left px-3 py-2 rounded-lg border transition-colors ${project.id === activeProjectId ? "bg-accent-muted border-accent/40 text-text-primary" : "bg-surface-muted border-border text-text-secondary hover:text-text-primary"}`,
          onClick: () => void handleSetActiveProject(project.id),
          children: [
            /* @__PURE__ */ jsx("div", { className: "font-medium text-sm truncate", children: project.name }),
            /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted truncate", children: project.description || "No description" })
          ]
        },
        project.id
      )) })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: `card p-4 space-y-4 ${showProjectColumn ? "xl:col-span-4" : "xl:col-span-6"}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(FolderOpen, { className: "w-4 h-4 text-accent" }),
          /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold", children: "Collections & Sources" })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "text-xs text-text-muted", children: activeProject?.name || "No project selected" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "input text-sm py-2",
                placeholder: "New collection",
                value: collectionName,
                onChange: (event) => setCollectionName(event.target.value)
              }
            ),
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary px-3", onClick: handleCreateCollection, children: /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }) })
          ] }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              className: "input text-sm py-2",
              value: selectedCollectionId,
              onChange: (event) => {
                const nextCollectionId = event.target.value;
                setSelectedCollectionId(nextCollectionId);
                if (activeProjectId && nextCollectionId) {
                  setProjectActiveCollection(activeProjectId, nextCollectionId);
                }
              },
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "All Collections" }),
                collections.map((collection) => /* @__PURE__ */ jsx("option", { value: collection.id, children: collection.name }, collection.id))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "input text-sm py-2",
              placeholder: "Source URL",
              value: sourceUrl,
              onChange: (event) => setSourceUrl(event.target.value)
            }
          ),
          /* @__PURE__ */ jsxs("button", { className: "btn btn-secondary w-full", onClick: handleImportUrl, children: [
            /* @__PURE__ */ jsx(Link2, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx("span", { children: "Import URL" })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "btn btn-secondary w-full cursor-pointer", children: [
            /* @__PURE__ */ jsx(Upload, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx("span", { children: uploading ? "Uploading..." : "Upload Files" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "file",
                multiple: true,
                className: "hidden",
                onChange: (event) => void handleImportFiles(event)
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "input text-sm py-2",
            placeholder: "Manual source title",
            value: sourceTitle,
            onChange: (event) => setSourceTitle(event.target.value)
          }
        ),
        /* @__PURE__ */ jsx(
          "textarea",
          {
            className: "input text-sm min-h-[90px]",
            placeholder: "Paste or write source content",
            value: sourceContent,
            onChange: (event) => setSourceContent(event.target.value)
          }
        ),
        /* @__PURE__ */ jsxs("button", { className: "btn btn-secondary w-full", onClick: handleCreateManualSource, children: [
          /* @__PURE__ */ jsx(FileText, { className: "w-4 h-4" }),
          /* @__PURE__ */ jsx("span", { children: "Add Source" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "space-y-2 max-h-[220px] overflow-y-auto pr-1", children: documents.map((doc) => /* @__PURE__ */ jsxs(
          "button",
          {
            className: `w-full text-left px-3 py-2 rounded-lg border ${doc.id === selectedDocumentId ? "border-accent/40 bg-accent-muted" : "border-border bg-surface-muted"}`,
            onClick: () => setSelectedDocumentId(doc.id),
            children: [
              /* @__PURE__ */ jsx("div", { className: "text-sm font-medium truncate", children: doc.title }),
              /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted truncate", children: doc.sourceUri && /^https?:\/\//i.test(doc.sourceUri) ? /* @__PURE__ */ jsx(
                "a",
                {
                  href: doc.sourceUri,
                  target: "_blank",
                  rel: "noreferrer",
                  onClick: (e) => e.stopPropagation(),
                  className: "underline hover:text-accent",
                  children: doc.sourceUri
                }
              ) : doc.sourceUri || doc.sourceType })
            ]
          },
          doc.id
        )) }),
        /* @__PURE__ */ jsxs("div", { className: "bg-surface-muted border border-border rounded-lg p-3 min-h-[220px]", children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs uppercase tracking-wide text-text-muted mb-2", children: "Source Viewer" }),
          selectedDocument ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold mb-1", children: selectedDocument.title }),
            /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted mb-2", children: selectedDocument.sourceUri && /^https?:\/\//i.test(selectedDocument.sourceUri) ? /* @__PURE__ */ jsx("a", { href: selectedDocument.sourceUri, target: "_blank", rel: "noreferrer", className: "underline hover:text-accent", children: selectedDocument.sourceUri }) : selectedDocument.sourceUri || selectedDocument.sourceType }),
            /* @__PURE__ */ jsx("div", { className: "text-sm whitespace-pre-wrap line-clamp-8", children: selectedDocument.content || "No content" })
          ] }) : /* @__PURE__ */ jsx("div", { className: "text-sm text-text-muted", children: "Select a source to view content." })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: `card p-4 space-y-4 ${showProjectColumn ? "xl:col-span-5" : "xl:col-span-6"}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Search, { className: "w-4 h-4 text-accent" }),
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold", children: "Deep Search & Agentic RAG" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost ml-auto px-2 py-1", onClick: () => void handleRefreshWorkspace(), title: "Refresh workspace", children: /* @__PURE__ */ jsx(RefreshCw, { className: "w-4 h-4" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "input text-sm py-2",
            placeholder: "Ask across project sources",
            value: ragQuery,
            onChange: (event) => setRagQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleRagSearch();
              }
            }
          }
        ),
        /* @__PURE__ */ jsxs("button", { className: "btn btn-primary", onClick: handleRagSearch, children: [
          /* @__PURE__ */ jsx(Search, { className: "w-4 h-4" }),
          /* @__PURE__ */ jsx("span", { children: "Search" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "space-y-2 max-h-[280px] overflow-y-auto pr-1", children: ragResults.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-sm text-text-muted bg-surface-muted border border-border rounded-lg p-3", children: "No results yet. Run a query after adding sources." }) : ragResults.map((item) => /* @__PURE__ */ jsxs("div", { className: "bg-surface-muted border border-border rounded-lg p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
          /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold truncate", children: item.title }),
          /* @__PURE__ */ jsxs("span", { className: "text-xs px-2 py-0.5 rounded bg-accent-muted text-accent", children: [
            "score ",
            item.score
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted truncate mb-2", children: item.sourceUri && /^https?:\/\//i.test(item.sourceUri) ? /* @__PURE__ */ jsx("a", { href: item.sourceUri, target: "_blank", rel: "noreferrer", className: "underline hover:text-accent", children: item.sourceUri }) : item.sourceUri || "local source" }),
        /* @__PURE__ */ jsx("div", { className: "text-sm", children: item.snippet || "No snippet" })
      ] }, item.id)) }),
      /* @__PURE__ */ jsxs("div", { className: "pt-2 border-t border-border", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
          /* @__PURE__ */ jsx(Activity, { className: "w-4 h-4 text-accent" }),
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold", children: "Run Logs" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2 max-h-[220px] overflow-y-auto pr-1", children: runs.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-sm text-text-muted", children: "No runs yet." }) : runs.map((run) => /* @__PURE__ */ jsxs("div", { className: "bg-surface-muted border border-border rounded-lg p-2.5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-1", children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm font-medium truncate", children: run.prompt || run.type }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-text-muted", children: run.status })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-xs text-text-muted", children: [
            "events: ",
            Array.isArray(run.events) ? run.events.length : 0
          ] })
        ] }, run.id)) })
      ] }),
      (loading || error) && /* @__PURE__ */ jsx("div", { className: `text-xs rounded px-3 py-2 ${error ? "bg-error/10 text-error" : "bg-surface-muted text-text-muted"}`, children: error || "Loading workspace..." })
    ] })
  ] });
}
function WelcomeView() {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    upsertProject,
    sessions,
    sessionProjectMap,
    sessionPlanMap,
    setActiveSession,
    workingDir,
    setWorkingDir
  } = useAppStore();
  const { startSession, changeWorkingDir } = useIPC();
  const [newProjectName, setNewProjectName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );
  const projectTasks = useMemo(() => {
    if (!activeProjectId) return [];
    return sessions.filter((session) => sessionProjectMap[session.id] === activeProjectId).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions, sessionProjectMap, activeProjectId]);
  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setError(null);
    try {
      const created = await headlessCreateProject(name);
      upsertProject(created);
      setActiveProjectId(created.id);
      await headlessSetActiveProject(created.id);
      setNewProjectName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const handleStartTask = async () => {
    if (!activeProjectId) {
      setError("Create or select a project first.");
      return;
    }
    const text = prompt.trim();
    if (!text || isSubmitting) return;
    const content = [{ type: "text", text }];
    setIsSubmitting(true);
    setError(null);
    try {
      const title = text.slice(0, 60) + (text.length > 60 ? "..." : "");
      await startSession(title, content, workingDir || void 0);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSelectFolder = async () => {
    const result = await changeWorkingDir();
    if (result.success && result.path) {
      setWorkingDir(result.path);
    }
  };
  if (projects.length === 0 || !activeProjectId) {
    return /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center p-8", children: /* @__PURE__ */ jsxs("div", { className: "card w-full max-w-xl p-6 space-y-4", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-xl font-semibold", children: "Create a Project First" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-text-secondary", children: "This workspace is project-oriented. Create a project to manage tasks, collections, sources, tools, and skills." }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "input",
            placeholder: "Project name",
            value: newProjectName,
            onChange: (event) => setNewProjectName(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreateProject();
              }
            }
          }
        ),
        /* @__PURE__ */ jsxs("button", { className: "btn btn-primary", onClick: () => void handleCreateProject(), children: [
          /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }),
          /* @__PURE__ */ jsx("span", { children: "Create" })
        ] })
      ] }),
      error && /* @__PURE__ */ jsx("div", { className: "text-sm text-error", children: error })
    ] }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-5 space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "card p-4 space-y-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h1", { className: "text-lg font-semibold", children: activeProject?.name || "Project" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-text-secondary", children: "Project dashboard: start tasks, inspect history, and manage project resources." })
        ] }),
        /* @__PURE__ */ jsxs("button", { className: "btn btn-secondary", onClick: handleSelectFolder, children: [
          /* @__PURE__ */ jsx(FolderOpen, { className: "w-4 h-4" }),
          /* @__PURE__ */ jsx("span", { children: workingDir ? workingDir.split(/[/\\]/).pop() : "Set Workdir" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "md:col-span-2 space-y-2", children: [
          /* @__PURE__ */ jsx(
            "textarea",
            {
              className: "input min-h-[96px]",
              placeholder: "Start a new task for this project",
              value: prompt,
              onChange: (event) => setPrompt(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleStartTask();
                }
              }
            }
          ),
          /* @__PURE__ */ jsxs("button", { className: "btn btn-primary", onClick: () => void handleStartTask(), disabled: !prompt.trim() || isSubmitting, children: [
            /* @__PURE__ */ jsx("span", { children: isSubmitting ? "Starting..." : "Start New Task" }),
            /* @__PURE__ */ jsx(ArrowRight, { className: "w-4 h-4" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-surface-muted border border-border rounded-xl p-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ jsx(ClipboardList, { className: "w-4 h-4 text-accent" }),
            /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold", children: "Task History" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2 max-h-[170px] overflow-y-auto pr-1", children: projectTasks.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: "No tasks yet." }) : projectTasks.map((task) => /* @__PURE__ */ jsxs(
            "button",
            {
              className: "w-full text-left px-2 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover",
              onClick: () => setActiveSession(task.id),
              children: [
                /* @__PURE__ */ jsx("div", { className: "text-sm truncate", children: task.title }),
                /* @__PURE__ */ jsx("div", { className: "text-xs text-text-muted", children: task.status }),
                sessionPlanMap[task.id]?.phases?.length ? /* @__PURE__ */ jsx("div", { className: "mt-1 flex flex-wrap gap-1", children: sessionPlanMap[task.id].phases.map((phase) => /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: `text-[10px] px-1.5 py-0.5 rounded ${phase.status === "completed" ? "bg-success/15 text-success" : phase.status === "running" ? "bg-accent/15 text-accent" : phase.status === "error" ? "bg-error/15 text-error" : "bg-surface-muted text-text-muted"}`,
                    children: phase.label
                  },
                  `${task.id}-${phase.key}`
                )) }) : null
              ]
            },
            task.id
          )) })
        ] })
      ] }),
      error && /* @__PURE__ */ jsx("div", { className: "text-sm text-error", children: error })
    ] }),
    /* @__PURE__ */ jsx(ProjectWorkspace, { fixedProjectId: activeProjectId, showProjectColumn: false })
  ] });
}
const _app__index = UNSAFE_withComponentProps(function AppIndex() {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  return activeSessionId ? /* @__PURE__ */ jsx(ChatView, {}) : /* @__PURE__ */ jsx(WelcomeView, {});
});
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _app__index
}, Symbol.toStringTag, { value: "Module" }));
const _app_settings = UNSAFE_withComponentProps(function SettingsRoute() {
  return /* @__PURE__ */ jsx(SettingsPanel, {});
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _app_settings
}, Symbol.toStringTag, { value: "Module" }));
async function loader$i() {
  return Response.json({
    ok: true,
    service: "open-analyst-headless"
  });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$i
}, Symbol.toStringTag, { value: "Module" }));
function getConfigDir() {
  const envDir = process.env.OPEN_ANALYST_DATA_DIR;
  if (envDir) return envDir;
  return path.join(os.homedir(), ".config", "open-analyst");
}
function ensureConfigDir(configDir) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
function loadJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed;
  } catch {
    return fallback;
  }
}
function saveJsonFile(filePath, value) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}
function loadJsonArray(filePath) {
  const result = loadJsonFile(filePath, []);
  return Array.isArray(result) ? result : [];
}
function saveJsonArray(filePath, value) {
  saveJsonFile(filePath, Array.isArray(value) ? value : []);
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
const CONFIG_FILENAME = "headless-config.json";
const DEFAULT_CONFIG = {
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  bedrockRegion: "us-east-1",
  model: "gpt-4o",
  openaiMode: "chat",
  workingDir: process.cwd(),
  workingDirType: "local",
  s3Uri: "",
  activeProjectId: ""
};
function inferBedrockRegion(baseUrl) {
  const value = String(baseUrl || "").toLowerCase();
  const runtimeMatch = value.match(
    /bedrock-runtime\.([a-z0-9-]+)\.amazonaws\.com/
  );
  if (runtimeMatch?.[1]) return runtimeMatch[1];
  const mantleMatch = value.match(
    /bedrock-mantle\.([a-z0-9-]+)\.api\.aws/
  );
  return mantleMatch?.[1] || "us-east-1";
}
function normalizeConfig(input) {
  const config = { ...DEFAULT_CONFIG, ...input };
  if (config.provider === "bedrock") {
    const region = String(config.bedrockRegion || "").trim().toLowerCase() || inferBedrockRegion(config.baseUrl);
    config.bedrockRegion = region || "us-east-1";
    if (!String(config.baseUrl || "").trim()) {
      config.baseUrl = `https://bedrock-mantle.${config.bedrockRegion}.api.aws/v1`;
    } else if (!String(config.baseUrl).trim().endsWith("/v1")) {
      config.baseUrl = `${String(config.baseUrl).replace(/\/+$/, "")}/v1`;
    }
    if (!config.openaiMode) config.openaiMode = "responses";
  }
  return config;
}
function loadConfig(configDir) {
  const dir = ensureConfigDir();
  const configPath = path.join(dir, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    const initial = normalizeConfig({ ...DEFAULT_CONFIG });
    fs.writeFileSync(configPath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  const parsed = loadJsonFile(configPath, {});
  return normalizeConfig({ ...DEFAULT_CONFIG, ...parsed });
}
function saveConfig(config, configDir) {
  const dir = ensureConfigDir();
  const normalized = normalizeConfig(config);
  saveJsonFile(path.join(dir, CONFIG_FILENAME), normalized);
}
function maskApiKey(key) {
  if (!key) return "";
  return "***";
}
async function loader$h() {
  const cfg = loadConfig();
  return Response.json({
    ...cfg,
    apiKey: maskApiKey(cfg.apiKey)
  });
}
async function action$l({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const cfg = {
    ...loadConfig(),
    ...body
  };
  saveConfig(cfg);
  return Response.json({
    success: true,
    config: {
      ...cfg,
      apiKey: maskApiKey(cfg.apiKey)
    }
  });
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$l,
  loader: loader$h
}, Symbol.toStringTag, { value: "Module" }));
async function loader$g() {
  const cfg = loadConfig();
  return Response.json({
    workingDir: cfg.workingDir,
    workingDirType: cfg.workingDirType || "local",
    s3Uri: cfg.s3Uri || ""
  });
}
async function action$k({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const cfg = loadConfig();
  const inputPath = String(body.path || "").trim();
  const workingDirType = String(body.workingDirType || (inputPath.startsWith("s3://") ? "s3" : "local"));
  if (!inputPath) {
    return Response.json({
      success: false,
      error: "path is required"
    }, {
      status: 400
    });
  }
  if (workingDirType === "local") {
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
      return Response.json({
        success: false,
        error: `Path not found: ${resolved}`
      }, {
        status: 400
      });
    }
    cfg.workingDir = resolved;
    cfg.workingDirType = "local";
    cfg.s3Uri = "";
  } else {
    cfg.workingDir = inputPath;
    cfg.workingDirType = "s3";
    cfg.s3Uri = inputPath;
  }
  saveConfig(cfg);
  return Response.json({
    success: true,
    path: cfg.workingDir,
    workingDirType: cfg.workingDirType
  });
}
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$k,
  loader: loader$g
}, Symbol.toStringTag, { value: "Module" }));
const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List directory contents",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write a UTF-8 text file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace first occurrence of old_string with new_string in a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" }
        },
        required: ["path", "old_string", "new_string"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "glob",
      description: "Find files with a glob pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string" }
        },
        required: ["pattern", "path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search file contents by regex",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string" }
        },
        required: ["pattern", "path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch URL content from the web with binary-safe handling and automatic source capture",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          collectionName: { type: "string" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for a query and return summary results",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "arxiv_search",
      description: "Search arXiv papers and capture results into the project collection",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          max_results: { type: "number" },
          collectionName: { type: "string" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "hf_daily_papers",
      description: "Fetch Hugging Face daily papers for a date (YYYY-MM-DD) and capture them",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string" },
          collectionName: { type: "string" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "hf_paper",
      description: "Fetch a Hugging Face paper by arXiv id and capture it",
      parameters: {
        type: "object",
        properties: {
          arxiv_id: { type: "string" },
          collectionName: { type: "string" }
        },
        required: ["arxiv_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deep_research",
      description: "Perform multi-step deep research: decompose query, search/fetch multiple sources, synthesize cited report, and store it.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          breadth: { type: "number" },
          fetch_limit: { type: "number" },
          collectionName: { type: "string" }
        },
        required: ["question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "collection_overview",
      description: "List what is in the active collection (or project) and summarize source contents.",
      parameters: {
        type: "object",
        properties: {
          collectionId: { type: "string" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "execute_command",
      description: "Run a shell command in the working directory",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          cwd: { type: "string" }
        },
        required: ["command", "cwd"]
      }
    }
  }
];
function listAvailableTools() {
  return TOOL_DEFS.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description
  }));
}
async function loader$f() {
  return Response.json({
    tools: listAvailableTools()
  });
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$f
}, Symbol.toStringTag, { value: "Module" }));
const CREDENTIALS_FILENAME = "credentials.json";
function getCredentialsPath(configDir) {
  return path.join(getConfigDir(), CREDENTIALS_FILENAME);
}
function listCredentials(configDir) {
  ensureConfigDir();
  return loadJsonArray(getCredentialsPath());
}
function createCredential(input, configDir) {
  const credentials2 = listCredentials();
  const now2 = nowIso();
  const credential = {
    id: randomUUID(),
    name: String(input.name || "").trim(),
    type: ["email", "website", "api", "other"].includes(input.type || "") ? input.type : "other",
    service: String(input.service || "").trim() || void 0,
    username: String(input.username || "").trim(),
    password: typeof input.password === "string" ? input.password : void 0,
    url: String(input.url || "").trim() || void 0,
    notes: String(input.notes || "").trim() || void 0,
    createdAt: now2,
    updatedAt: now2
  };
  credentials2.unshift(credential);
  saveJsonArray(getCredentialsPath(), credentials2);
  return credential;
}
function updateCredential(id, updates, configDir) {
  const credentials2 = listCredentials();
  const idx = credentials2.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const previous = credentials2[idx];
  credentials2[idx] = {
    ...previous,
    ...updates,
    id: previous.id,
    createdAt: previous.createdAt,
    updatedAt: nowIso()
  };
  saveJsonArray(getCredentialsPath(), credentials2);
  return credentials2[idx];
}
function deleteCredential(id, configDir) {
  const credentials2 = listCredentials();
  const next = credentials2.filter((item) => item.id !== id);
  saveJsonArray(getCredentialsPath(), next);
  return { success: true };
}
async function loader$e() {
  return Response.json({
    credentials: listCredentials()
  });
}
async function action$j({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  if (!String(body.name || "").trim() || !String(body.username || "").trim()) {
    return Response.json({
      error: "name and username are required"
    }, {
      status: 400
    });
  }
  const credential = createCredential(body);
  return Response.json({
    credential
  }, {
    status: 201
  });
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$j,
  loader: loader$e
}, Symbol.toStringTag, { value: "Module" }));
async function action$i({
  request,
  params
}) {
  const id = params.id;
  if (request.method === "PATCH") {
    const body = await request.json();
    const credential = updateCredential(id, body);
    if (!credential) {
      return Response.json({
        error: `Credential not found: ${id}`
      }, {
        status: 404
      });
    }
    return Response.json({
      credential
    });
  }
  if (request.method === "DELETE") {
    deleteCredential(id);
    return Response.json({
      success: true
    });
  }
  return Response.json({
    error: "Method not allowed"
  }, {
    status: 405
  });
}
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$i
}, Symbol.toStringTag, { value: "Module" }));
const MCP_SERVERS_FILENAME = "mcp-servers.json";
function getServersPath(configDir) {
  return path.join(getConfigDir(), MCP_SERVERS_FILENAME);
}
function defaultMcpServers() {
  return [
    {
      id: "mcp-example-filesystem",
      name: "Filesystem (Example)",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      env: {},
      enabled: false
    }
  ];
}
function getMcpPresets() {
  return {
    filesystem: {
      name: "Filesystem",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      requiresEnv: [],
      env: {}
    },
    fetch: {
      name: "Fetch",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
      requiresEnv: [],
      env: {}
    },
    github: {
      name: "GitHub",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      requiresEnv: ["GITHUB_TOKEN"],
      env: {}
    }
  };
}
function listMcpServers(configDir) {
  ensureConfigDir();
  const existing = loadJsonArray(getServersPath());
  if (existing.length) return existing;
  const defaults = defaultMcpServers();
  saveJsonArray(getServersPath(), defaults);
  return defaults;
}
function saveMcpServer(input, configDir) {
  const servers = listMcpServers();
  const serverConfig = {
    id: String(input.id || "").trim() || `mcp-${Date.now()}`,
    name: String(input.name || "").trim() || "MCP Server",
    type: input.type === "sse" ? "sse" : "stdio",
    command: typeof input.command === "string" ? input.command : void 0,
    args: Array.isArray(input.args) ? input.args.map((item) => String(item)) : void 0,
    env: input.env && typeof input.env === "object" ? input.env : void 0,
    url: typeof input.url === "string" ? input.url : void 0,
    headers: input.headers && typeof input.headers === "object" ? input.headers : void 0,
    enabled: input.enabled !== false
  };
  const idx = servers.findIndex((item) => item.id === serverConfig.id);
  if (idx === -1) {
    servers.unshift(serverConfig);
  } else {
    servers[idx] = serverConfig;
  }
  saveJsonArray(getServersPath(), servers);
  return serverConfig;
}
function deleteMcpServer(id, configDir) {
  const servers = listMcpServers();
  const next = servers.filter((item) => item.id !== id);
  saveJsonArray(getServersPath(), next);
  return { success: true };
}
function getMcpStatus(configDir) {
  const servers = listMcpServers();
  return servers.map((server) => ({
    id: server.id,
    name: server.name,
    connected: Boolean(server.enabled),
    toolCount: server.enabled ? listAvailableTools().length : 0
  }));
}
function getMcpTools(configDir) {
  const servers = listMcpServers().filter((s) => s.enabled);
  return servers.flatMap(
    (server) => listAvailableTools().map((tool) => ({
      serverId: server.id,
      name: tool.name,
      description: tool.description
    }))
  );
}
async function loader$d() {
  return Response.json({
    presets: getMcpPresets()
  });
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$d
}, Symbol.toStringTag, { value: "Module" }));
async function loader$c() {
  return Response.json({
    servers: listMcpServers()
  });
}
async function action$h({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const server = saveMcpServer(body);
  return Response.json({
    server
  });
}
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$h,
  loader: loader$c
}, Symbol.toStringTag, { value: "Module" }));
async function action$g({
  request,
  params
}) {
  if (request.method !== "DELETE") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  deleteMcpServer(params.id);
  return Response.json({
    success: true
  });
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$g
}, Symbol.toStringTag, { value: "Module" }));
async function loader$b() {
  return Response.json({
    statuses: getMcpStatus()
  });
}
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
async function loader$a() {
  return Response.json({
    tools: getMcpTools()
  });
}
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$a
}, Symbol.toStringTag, { value: "Module" }));
const SKILLS_FILENAME = "skills.json";
function getSkillsPath(configDir) {
  return path.join(getConfigDir(), SKILLS_FILENAME);
}
function defaultSkills() {
  const ts = Date.now();
  return [
    {
      id: "builtin-web-research",
      name: "Web Research",
      description: "Web search/fetch/arXiv/HF capture workflow",
      type: "builtin",
      enabled: true,
      config: {
        tools: [
          "deep_research",
          "web_search",
          "web_fetch",
          "arxiv_search",
          "hf_daily_papers",
          "hf_paper"
        ]
      },
      createdAt: ts
    },
    {
      id: "builtin-code-ops",
      name: "Code Operations",
      description: "Read/write/edit/grep/glob/execute workflow",
      type: "builtin",
      enabled: true,
      config: {
        tools: [
          "list_directory",
          "read_file",
          "write_file",
          "edit_file",
          "glob",
          "grep",
          "execute_command"
        ]
      },
      createdAt: ts
    }
  ];
}
function listSkills(configDir) {
  ensureConfigDir();
  const existing = loadJsonArray(getSkillsPath());
  if (existing.length) return existing;
  const defaults = defaultSkills();
  saveJsonArray(getSkillsPath(), defaults);
  return defaults;
}
function validateSkillPath(folderPath) {
  const errors = [];
  if (!folderPath) {
    errors.push("folderPath is required");
  } else {
    if (!fs.existsSync(folderPath)) errors.push("Folder does not exist");
    if (fs.existsSync(folderPath) && !fs.statSync(folderPath).isDirectory())
      errors.push("Path is not a directory");
    if (fs.existsSync(folderPath) && !fs.existsSync(path.join(folderPath, "SKILL.md")))
      errors.push("Missing SKILL.md");
  }
  return { valid: errors.length === 0, errors };
}
function installSkill(folderPath, configDir) {
  const skillPath = path.resolve(folderPath);
  const skillName = path.basename(skillPath);
  const skill = {
    id: `skill-${randomUUID()}`,
    name: skillName,
    description: `Installed from ${skillPath}`,
    type: "custom",
    enabled: true,
    config: { folderPath: skillPath },
    createdAt: Date.now()
  };
  const skills2 = listSkills();
  skills2.unshift(skill);
  saveJsonArray(getSkillsPath(), skills2);
  return skill;
}
function deleteSkill(id, configDir) {
  const skills2 = listSkills();
  saveJsonArray(
    getSkillsPath(),
    skills2.filter((item) => item.id !== id)
  );
  return { success: true };
}
function setSkillEnabled(id, enabled, configDir) {
  const skills2 = listSkills();
  const idx = skills2.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  skills2[idx] = { ...skills2[idx], enabled };
  saveJsonArray(getSkillsPath(), skills2);
  return skills2[idx];
}
async function loader$9() {
  return Response.json({
    skills: listSkills()
  });
}
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
async function action$f({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const folderPath = String(body.folderPath || "").trim();
  const result = validateSkillPath(folderPath);
  return Response.json(result);
}
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$f
}, Symbol.toStringTag, { value: "Module" }));
async function action$e({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const folderPath = String(body.folderPath || "").trim();
  if (!folderPath) {
    return Response.json({
      error: "folderPath is required"
    }, {
      status: 400
    });
  }
  const skillPath = path.resolve(folderPath);
  if (!fs.existsSync(skillPath) || !fs.statSync(skillPath).isDirectory()) {
    return Response.json({
      error: "folderPath must be an existing directory"
    }, {
      status: 400
    });
  }
  if (!fs.existsSync(path.join(skillPath, "SKILL.md"))) {
    return Response.json({
      error: "SKILL.md not found in folderPath"
    }, {
      status: 400
    });
  }
  const skill = installSkill(folderPath);
  return Response.json({
    success: true,
    skill
  });
}
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$e
}, Symbol.toStringTag, { value: "Module" }));
async function action$d({
  request,
  params
}) {
  if (request.method !== "DELETE") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  deleteSkill(params.id);
  return Response.json({
    success: true
  });
}
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$d
}, Symbol.toStringTag, { value: "Module" }));
async function action$c({
  request,
  params
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const enabled = body.enabled !== false;
  const skill = setSkillEnabled(params.id, enabled);
  if (!skill) {
    return Response.json({
      error: `Skill not found: ${params.id}`
    }, {
      status: 404
    });
  }
  return Response.json({
    success: true,
    skill
  });
}
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$c
}, Symbol.toStringTag, { value: "Module" }));
const LOGS_DIRNAME = "logs";
function getLogsDir(configDir) {
  return path.join(getConfigDir(), LOGS_DIRNAME);
}
function ensureLogsDir(configDir) {
  const dir = getLogsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
function listLogs(configDir) {
  const dir = ensureLogsDir();
  const files = fs.readdirSync(dir).map((name) => path.join(dir, name)).filter((item) => fs.statSync(item).isFile()).map((item) => {
    const stat = fs.statSync(item);
    return {
      name: path.basename(item),
      path: item,
      size: stat.size,
      mtime: stat.mtime.toISOString()
    };
  }).sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));
  return { files, directory: dir };
}
function isLogsEnabled(configDir) {
  const cfg = loadConfig();
  return cfg.devLogsEnabled !== false;
}
function setLogsEnabled(enabled, configDir) {
  const cfg = loadConfig();
  cfg.devLogsEnabled = enabled;
  saveConfig(cfg);
  return { success: true, enabled };
}
function exportLogs(configDir) {
  const dir = ensureLogsDir();
  const exportPath = path.join(dir, `open-analyst-logs-${Date.now()}.txt`);
  const files = fs.readdirSync(dir).map((name) => path.join(dir, name)).filter((item) => fs.statSync(item).isFile() && item !== exportPath);
  const bodyText = files.map((filePath) => {
    const name = path.basename(filePath);
    const text = fs.readFileSync(filePath, "utf8");
    return `
===== ${name} =====
${text}`;
  }).join("\n");
  fs.writeFileSync(exportPath, bodyText || "No logs available.", "utf8");
  return { success: true, path: exportPath };
}
function clearLogs(configDir) {
  const dir = ensureLogsDir();
  const files = fs.readdirSync(dir).map((name) => path.join(dir, name)).filter((item) => fs.statSync(item).isFile());
  let deletedCount = 0;
  for (const filePath of files) {
    fs.unlinkSync(filePath);
    deletedCount += 1;
  }
  return { success: true, deletedCount };
}
async function loader$8() {
  const result = listLogs();
  return Response.json(result);
}
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$8
}, Symbol.toStringTag, { value: "Module" }));
async function loader$7() {
  return Response.json({
    enabled: isLogsEnabled()
  });
}
async function action$b({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const result = setLogsEnabled(body.enabled !== false);
  return Response.json(result);
}
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$b,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
async function action$a({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const result = exportLogs();
  return Response.json(result);
}
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$a
}, Symbol.toStringTag, { value: "Module" }));
async function action$9({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const result = clearLogs();
  return Response.json(result);
}
const route23 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9
}, Symbol.toStringTag, { value: "Module" }));
const STORE_FILENAME = "projects-store.json";
function now() {
  return Date.now();
}
function getStorePath(configDir) {
  return path.join(getConfigDir(), STORE_FILENAME);
}
function createProjectTemplate(input = {}) {
  const ts = now();
  return {
    id: input.id || randomUUID(),
    name: String(input.name || "Untitled Project").trim(),
    description: String(input.description || "").trim(),
    createdAt: ts,
    updatedAt: ts,
    datastores: Array.isArray(input.datastores) && input.datastores.length ? input.datastores : [
      {
        id: randomUUID(),
        name: "local-default",
        type: "local",
        config: { basePath: "" },
        isDefault: true
      }
    ],
    collections: [],
    documents: [],
    runs: []
  };
}
function defaultStore() {
  const defaultProject = createProjectTemplate({
    name: "Default Project",
    description: "Auto-created default project"
  });
  return {
    version: 1,
    activeProjectId: defaultProject.id,
    projects: [defaultProject]
  };
}
function parseStore(raw) {
  if (!raw || typeof raw !== "object") return defaultStore();
  const obj = raw;
  const projects = Array.isArray(obj.projects) ? obj.projects : [];
  if (!projects.length) return defaultStore();
  const activeProjectId = obj.activeProjectId && projects.some((p) => p.id === obj.activeProjectId) ? obj.activeProjectId : projects[0].id;
  return { version: 1, activeProjectId, projects };
}
function loadStore(configDir) {
  const dir = ensureConfigDir();
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
function saveStore(store, configDir) {
  const dir = ensureConfigDir();
  fs.writeFileSync(
    path.join(dir, STORE_FILENAME),
    JSON.stringify(store, null, 2),
    "utf8"
  );
}
function sortByUpdatedDesc(items) {
  return [...items].sort(
    (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
  );
}
function findProjectOrThrow(store, projectId) {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}
function touchProject(project) {
  project.updatedAt = now();
}
function createProjectStore(configDir) {
  return {
    get STORE_PATH() {
      return getStorePath();
    },
    createProject(input = {}) {
      const store = loadStore();
      const project = createProjectTemplate(input);
      store.projects.push(project);
      store.activeProjectId = project.id;
      saveStore(store);
      return project;
    },
    listProjects() {
      const store = loadStore();
      return sortByUpdatedDesc(store.projects);
    },
    getProject(projectId) {
      const store = loadStore();
      return store.projects.find((p) => p.id === projectId) || null;
    },
    setActiveProject(projectId) {
      const store = loadStore();
      findProjectOrThrow(store, projectId);
      store.activeProjectId = projectId;
      saveStore(store);
      return { activeProjectId: projectId };
    },
    getActiveProject() {
      const store = loadStore();
      const project = store.projects.find((p) => p.id === store.activeProjectId) || store.projects[0];
      return project || null;
    },
    updateProject(projectId, updates = {}) {
      const store = loadStore();
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
      saveStore(store);
      return project;
    },
    deleteProject(projectId) {
      const store = loadStore();
      const before = store.projects.length;
      store.projects = store.projects.filter((p) => p.id !== projectId);
      if (store.projects.length === before) {
        throw new Error(`Project not found: ${projectId}`);
      }
      if (!store.projects.length) {
        const replacement = createProjectTemplate({
          name: "Default Project",
          description: "Auto-created default project"
        });
        store.projects = [replacement];
        store.activeProjectId = replacement.id;
      } else if (store.activeProjectId === projectId) {
        store.activeProjectId = store.projects[0].id;
      }
      saveStore(store);
      return { success: true };
    },
    listCollections(projectId) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      return sortByUpdatedDesc(project.collections || []);
    },
    createCollection(projectId, input = {}) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      const ts = now();
      const collection = {
        id: input.id || randomUUID(),
        name: String(input.name || "Untitled Collection").trim(),
        description: String(input.description || "").trim(),
        createdAt: ts,
        updatedAt: ts
      };
      project.collections = Array.isArray(project.collections) ? project.collections : [];
      project.collections.push(collection);
      touchProject(project);
      saveStore(store);
      return collection;
    },
    ensureCollection(projectId, name, description = "") {
      const trimmed = String(name || "").trim();
      if (!trimmed) throw new Error("Collection name is required");
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      project.collections = Array.isArray(project.collections) ? project.collections : [];
      const existing = project.collections.find(
        (item) => item.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) return existing;
      const ts = now();
      const collection = {
        id: randomUUID(),
        name: trimmed,
        description: String(description || "").trim(),
        createdAt: ts,
        updatedAt: ts
      };
      project.collections.push(collection);
      touchProject(project);
      saveStore(store);
      return collection;
    },
    listDocuments(projectId, collectionId) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      const all = Array.isArray(project.documents) ? project.documents : [];
      const filtered = collectionId ? all.filter((doc) => doc.collectionId === collectionId) : all;
      return sortByUpdatedDesc(filtered);
    },
    createDocument(projectId, input = {}) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      const ts = now();
      const doc = {
        id: input.id || randomUUID(),
        collectionId: input.collectionId || null,
        title: String(input.title || "Untitled Source").trim(),
        sourceType: String(input.sourceType || "manual"),
        sourceUri: String(input.sourceUri || ""),
        content: String(input.content || ""),
        metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
        createdAt: ts,
        updatedAt: ts
      };
      project.documents = Array.isArray(project.documents) ? project.documents : [];
      project.documents.push(doc);
      touchProject(project);
      saveStore(store);
      return doc;
    },
    createRun(projectId, input = {}) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      const ts = now();
      const run = {
        id: input.id || randomUUID(),
        type: String(input.type || "chat"),
        status: String(input.status || "running"),
        prompt: String(input.prompt || ""),
        output: String(input.output || ""),
        events: Array.isArray(input.events) ? input.events : [],
        createdAt: ts,
        updatedAt: ts
      };
      project.runs = Array.isArray(project.runs) ? project.runs : [];
      project.runs.push(run);
      touchProject(project);
      saveStore(store);
      return run;
    },
    listRuns(projectId) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      return sortByUpdatedDesc(project.runs || []);
    },
    getRun(projectId, runId) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      return (project.runs || []).find((run) => run.id === runId) || null;
    },
    appendRunEvent(projectId, runId, eventType, payload = {}) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      const run = (project.runs || []).find((item) => item.id === runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      const event = {
        id: randomUUID(),
        type: String(eventType || "event"),
        payload,
        timestamp: now()
      };
      run.events = Array.isArray(run.events) ? run.events : [];
      run.events.push(event);
      run.updatedAt = now();
      touchProject(project);
      saveStore(store);
      return event;
    },
    updateRun(projectId, runId, updates = {}) {
      const store = loadStore();
      const project = findProjectOrThrow(store, projectId);
      const run = (project.runs || []).find((item) => item.id === runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      if (typeof updates.status === "string") run.status = updates.status;
      if (typeof updates.output === "string") run.output = updates.output;
      run.updatedAt = now();
      touchProject(project);
      saveStore(store);
      return run;
    },
    queryDocuments(projectId, query, options = {}) {
      const limit = Math.min(20, Math.max(1, Number(options.limit || 8)));
      const docs = this.listDocuments(projectId, options.collectionId);
      const variants = buildQueryVariants(query);
      const stats = buildDocStats(docs);
      const aggregated = /* @__PURE__ */ new Map();
      for (const variant of variants) {
        const queryTokens = tokenizeQuery(variant);
        for (const entry2 of stats.tokenizedDocs) {
          const score = scoreDocument(
            variant,
            queryTokens,
            entry2,
            stats.df,
            docs.length
          );
          if (score <= 0) continue;
          const existing = aggregated.get(entry2.doc.id) || {
            doc: entry2.doc,
            score: 0,
            snippetTokens: []
          };
          existing.score = Math.max(existing.score, score);
          existing.snippetTokens = queryTokens;
          aggregated.set(entry2.doc.id, existing);
        }
      }
      const scored = Array.from(aggregated.values()).sort((a, b) => b.score - a.score).slice(0, limit).map(({ doc, score, snippetTokens }) => ({
        id: doc.id,
        title: doc.title,
        sourceUri: doc.sourceUri,
        score: Number(score.toFixed(3)),
        snippet: extractSnippet(doc.content, snippetTokens),
        metadata: doc.metadata || {}
      }));
      return {
        query,
        queryVariants: variants,
        totalCandidates: docs.length,
        results: scored
      };
    }
  };
}
const STOPWORDS = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "that",
  "this",
  "it",
  "as",
  "about",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how"
]);
function tokenize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
function normalizeToken(token) {
  let t2 = String(token || "").trim().toLowerCase();
  if (t2.length > 4 && t2.endsWith("ing")) t2 = t2.slice(0, -3);
  if (t2.length > 3 && t2.endsWith("ed")) t2 = t2.slice(0, -2);
  if (t2.length > 3 && t2.endsWith("es")) t2 = t2.slice(0, -2);
  if (t2.length > 2 && t2.endsWith("s")) t2 = t2.slice(0, -1);
  return t2;
}
function buildQueryVariants(query) {
  const raw = String(query || "").trim();
  if (!raw) return [];
  const variants = /* @__PURE__ */ new Set([raw]);
  const splitters = /\b(?:and|or|then|vs|versus)\b|[,;]+/gi;
  const parts = raw.split(splitters).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) variants.add(part);
  if (parts.length > 1) variants.add(parts.join(" "));
  return Array.from(variants).slice(0, 6);
}
function tokenizeQuery(query) {
  const base = tokenize(query).map(normalizeToken).filter((token) => token && !STOPWORDS.has(token));
  return Array.from(new Set(base)).slice(0, 32);
}
function buildDocStats(docs) {
  const df = /* @__PURE__ */ new Map();
  const tokenizedDocs = docs.map((doc) => {
    const tokens = tokenize(`${doc.title || ""} ${doc.content || ""}`).map(normalizeToken).filter(Boolean);
    const unique = new Set(tokens);
    for (const token of unique) {
      df.set(token, (df.get(token) || 0) + 1);
    }
    return {
      doc,
      tokens,
      text: `${doc.title || ""} ${doc.content || ""}`.toLowerCase()
    };
  });
  return { df, tokenizedDocs };
}
function scoreDocument(query, queryTokens, statsEntry, df, docCount) {
  if (!queryTokens.length) return 0;
  const tf = /* @__PURE__ */ new Map();
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
function extractSnippet(content, queryTokens) {
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
async function loader$6() {
  const store = createProjectStore();
  return Response.json({
    activeProject: store.getActiveProject(),
    projects: store.listProjects()
  });
}
async function action$8({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const store = createProjectStore();
  const project = store.createProject({
    name: body.name,
    description: body.description,
    datastores: body.datastores
  });
  const cfg = loadConfig();
  cfg.activeProjectId = project.id;
  saveConfig(cfg);
  return Response.json({
    project,
    activeProjectId: project.id
  }, {
    status: 201
  });
}
const route24 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
async function action$7({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const projectId = String(body.projectId || "").trim();
  if (!projectId) {
    return Response.json({
      error: "projectId is required"
    }, {
      status: 400
    });
  }
  const store = createProjectStore();
  store.setActiveProject(projectId);
  const cfg = loadConfig();
  cfg.activeProjectId = projectId;
  saveConfig(cfg);
  return Response.json({
    success: true,
    activeProjectId: projectId
  });
}
const route25 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7
}, Symbol.toStringTag, { value: "Module" }));
async function loader$5({
  params
}) {
  const store = createProjectStore();
  const project = store.getProject(params.projectId);
  if (!project) {
    return Response.json({
      error: `Project not found: ${params.projectId}`
    }, {
      status: 404
    });
  }
  return Response.json({
    project
  });
}
async function action$6({
  request,
  params
}) {
  const store = createProjectStore();
  const projectId = params.projectId;
  if (request.method === "PATCH") {
    const body = await request.json();
    try {
      const project = store.updateProject(projectId, body);
      return Response.json({
        project
      });
    } catch (err) {
      return Response.json({
        error: err instanceof Error ? err.message : String(err)
      }, {
        status: 404
      });
    }
  }
  if (request.method === "DELETE") {
    try {
      const deleted = store.deleteProject(projectId);
      const activeProject = store.getActiveProject();
      const cfg = loadConfig();
      cfg.activeProjectId = activeProject ? activeProject.id : "";
      saveConfig(cfg);
      return Response.json({
        ...deleted,
        activeProjectId: cfg.activeProjectId
      });
    } catch (err) {
      return Response.json({
        error: err instanceof Error ? err.message : String(err)
      }, {
        status: 404
      });
    }
  }
  return Response.json({
    error: "Method not allowed"
  }, {
    status: 405
  });
}
const route26 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
async function loader$4({
  params
}) {
  const store = createProjectStore();
  const collections = store.listCollections(params.projectId);
  return Response.json({
    collections
  });
}
async function action$5({
  request,
  params
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const store = createProjectStore();
  const collection = store.createCollection(params.projectId, {
    name: body.name,
    description: body.description
  });
  return Response.json({
    collection
  }, {
    status: 201
  });
}
const route27 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
async function loader$3({
  request,
  params
}) {
  const url = new URL(request.url);
  const collectionId = url.searchParams.get("collectionId") || "";
  const store = createProjectStore();
  const documents = store.listDocuments(params.projectId, collectionId || void 0);
  return Response.json({
    documents
  });
}
async function action$4({
  request,
  params
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const store = createProjectStore();
  const document2 = store.createDocument(params.projectId, {
    collectionId: body.collectionId,
    title: body.title,
    sourceType: body.sourceType,
    sourceUri: body.sourceUri,
    content: body.content,
    metadata: body.metadata
  });
  return Response.json({
    document: document2
  }, {
    status: 201
  });
}
const route28 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
function validateHttpUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("url is required");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are supported");
  }
  return parsed.toString();
}
async function action$3({
  request,
  params
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const url = validateHttpUrl(body.url);
  const fetchRes = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "open-analyst-headless"
    }
  });
  const contentType = fetchRes.headers.get("content-type") || "unknown";
  const content = await fetchRes.text();
  const title = String(body.title || url);
  const store = createProjectStore();
  const document2 = store.createDocument(params.projectId, {
    collectionId: body.collectionId,
    title,
    sourceType: "url",
    sourceUri: url,
    content,
    metadata: {
      contentType,
      status: fetchRes.status
    }
  });
  return Response.json({
    document: document2
  }, {
    status: 201
  });
}
const route29 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
function inferExtension(contentType) {
  const value = String(contentType || "").toLowerCase();
  if (value.includes("pdf")) return ".pdf";
  if (value.includes("json")) return ".json";
  if (value.includes("html")) return ".html";
  if (value.includes("xml")) return ".xml";
  if (value.includes("markdown")) return ".md";
  if (value.includes("plain")) return ".txt";
  return ".bin";
}
function sanitizeFilename(value) {
  return String(value || "source").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "source";
}
function inferTextFromBuffer(buffer, mimeType, filename) {
  const type = String(mimeType || "").toLowerCase();
  const lowerName = String(filename || "").toLowerCase();
  if (type.includes("text/") || type.includes("json") || type.includes("xml") || type.includes("yaml") || type.includes("csv") || lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".json") || lowerName.endsWith(".csv") || lowerName.endsWith(".xml") || lowerName.endsWith(".yml") || lowerName.endsWith(".yaml") || lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
    return buffer.toString("utf8");
  }
  return "";
}
async function action$2({
  request,
  params
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const projectId = params.projectId;
  const filename = String(body.filename || "uploaded-file").trim();
  const mimeType = String(body.mimeType || "application/octet-stream").trim();
  const base64 = String(body.contentBase64 || "").trim();
  if (!base64) {
    return Response.json({
      error: "contentBase64 is required"
    }, {
      status: 400
    });
  }
  const buffer = Buffer.from(base64, "base64");
  const capturesDir = path.join(getConfigDir(), "captures", projectId);
  if (!fs.existsSync(capturesDir)) {
    fs.mkdirSync(capturesDir, {
      recursive: true
    });
  }
  const extension = path.extname(filename) || inferExtension(mimeType);
  const storedName = `${sanitizeFilename(path.basename(filename, path.extname(filename)))}-${Date.now()}${extension}`;
  const capturePath = path.join(capturesDir, storedName);
  fs.writeFileSync(capturePath, buffer);
  let content = inferTextFromBuffer(buffer, mimeType, filename);
  if (!content && (mimeType.includes("pdf") || filename.toLowerCase().endsWith(".pdf"))) {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      content = String(parsed.text || "").replace(/\s+/g, " ").trim();
    } catch {
      content = "";
    }
  }
  const store = createProjectStore();
  const document2 = store.createDocument(projectId, {
    collectionId: body.collectionId,
    title: body.title || filename,
    sourceType: "file",
    sourceUri: `file://${capturePath}`,
    content: content || `[Binary file stored at ${capturePath}]`,
    metadata: {
      filename,
      mimeType,
      bytes: buffer.length,
      capturePath,
      extractedTextLength: content.length
    }
  });
  return Response.json({
    document: document2
  }, {
    status: 201
  });
}
const route30 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2
}, Symbol.toStringTag, { value: "Module" }));
async function action$1({
  request,
  params
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const query = String(body.query || "").trim();
  if (!query) {
    return Response.json({
      error: "query is required"
    }, {
      status: 400
    });
  }
  const store = createProjectStore();
  const result = store.queryDocuments(params.projectId, query, {
    limit: body.limit,
    collectionId: body.collectionId
  });
  return Response.json(result);
}
const route31 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1
}, Symbol.toStringTag, { value: "Module" }));
async function loader$2({
  params
}) {
  const store = createProjectStore();
  return Response.json({
    runs: store.listRuns(params.projectId)
  });
}
const route32 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
async function loader$1({
  params
}) {
  const store = createProjectStore();
  const run = store.getRun(params.projectId, params.runId);
  if (!run) {
    return Response.json({
      error: `Run not found: ${params.runId}`
    }, {
      status: 404
    });
  }
  return Response.json({
    run
  });
}
const route33 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
async function action({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const body = await request.json();
  const cfg = loadConfig();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const prompt = String(body.prompt || "").trim();
  const projectId = String(body.projectId || cfg.activeProjectId || "").trim();
  const collectionId = String(body.collectionId || "").trim();
  const collectionName = String(body.collectionName || "").trim();
  const deepResearch = body.deepResearch === true;
  if (!projectId) {
    return Response.json({
      error: "No active project configured. Create/select a project first."
    }, {
      status: 400
    });
  }
  const store = createProjectStore();
  const chatMessages = messages.length ? messages : [{
    role: "user",
    content: prompt
  }];
  const run = store.createRun(projectId, {
    type: "chat",
    status: "running",
    prompt
  });
  store.appendRunEvent(projectId, run.id, "chat_requested", {
    messageCount: chatMessages.length
  });
  try {
    const {
      runAgentChat
    } = await import("./assets/chat.server-g6dbiUP1.js");
    const result = await runAgentChat(cfg, chatMessages, {
      projectId,
      collectionId: collectionId || void 0,
      collectionName: collectionName || "Task Sources",
      deepResearch,
      onRunEvent: (eventType, payload) => {
        store.appendRunEvent(projectId, run.id, eventType, payload);
      }
    });
    store.updateRun(projectId, run.id, {
      status: "completed",
      output: result.text || ""
    });
    store.appendRunEvent(projectId, run.id, "chat_completed", {
      traceCount: Array.isArray(result.traces) ? result.traces.length : 0
    });
    return Response.json({
      ok: true,
      text: result.text,
      traces: result.traces || [],
      runId: run.id,
      projectId
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store.appendRunEvent(projectId, run.id, "chat_failed", {
      error: msg
    });
    store.updateRun(projectId, run.id, {
      status: "failed",
      output: msg
    });
    return Response.json({
      error: msg
    }, {
      status: 500
    });
  }
}
const route34 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action
}, Symbol.toStringTag, { value: "Module" }));
async function loader() {
  const store = createProjectStore();
  const storePath = store.STORE_PATH;
  if (!fs.existsSync(storePath)) {
    return new Response("{}", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
  return new Response(fs.readFileSync(storePath, "utf8"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
const route35 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-B7ORr0Dx.js", "imports": ["/assets/chunk-JZWAC4HX-DjklJ5Ra.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/root-frc0Dsd6.js", "imports": ["/assets/chunk-JZWAC4HX-DjklJ5Ra.js"], "css": ["/assets/root-CEQPzGc4.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_app": { "id": "routes/_app", "parentId": "root", "path": void 0, "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_app-DbP_99yN.js", "imports": ["/assets/chunk-JZWAC4HX-DjklJ5Ra.js", "/assets/x-DgQP6NLW.js", "/assets/react-i18next-BW7SxSbv.js", "/assets/SettingsPanel-FS9Y2mah.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_app._index": { "id": "routes/_app._index", "parentId": "routes/_app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_app._index-8Cayawc4.js", "imports": ["/assets/chunk-JZWAC4HX-DjklJ5Ra.js", "/assets/x-DgQP6NLW.js", "/assets/react-i18next-BW7SxSbv.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_app.settings": { "id": "routes/_app.settings", "parentId": "routes/_app", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_app.settings-DFmm2Tdf.js", "imports": ["/assets/chunk-JZWAC4HX-DjklJ5Ra.js", "/assets/SettingsPanel-FS9Y2mah.js", "/assets/x-DgQP6NLW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.health": { "id": "routes/api.health", "parentId": "root", "path": "api/health", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.health-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.config": { "id": "routes/api.config", "parentId": "root", "path": "api/config", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.config-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.workdir": { "id": "routes/api.workdir", "parentId": "root", "path": "api/workdir", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.workdir-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.tools": { "id": "routes/api.tools", "parentId": "root", "path": "api/tools", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.tools-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.credentials": { "id": "routes/api.credentials", "parentId": "root", "path": "api/credentials", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.credentials-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.credentials.$id": { "id": "routes/api.credentials.$id", "parentId": "root", "path": "api/credentials/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.credentials._id-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.mcp.presets": { "id": "routes/api.mcp.presets", "parentId": "root", "path": "api/mcp/presets", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.mcp.presets-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.mcp.servers": { "id": "routes/api.mcp.servers", "parentId": "root", "path": "api/mcp/servers", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.mcp.servers-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.mcp.servers.$id": { "id": "routes/api.mcp.servers.$id", "parentId": "root", "path": "api/mcp/servers/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.mcp.servers._id-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.mcp.status": { "id": "routes/api.mcp.status", "parentId": "root", "path": "api/mcp/status", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.mcp.status-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.mcp.tools": { "id": "routes/api.mcp.tools", "parentId": "root", "path": "api/mcp/tools", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.mcp.tools-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.skills": { "id": "routes/api.skills", "parentId": "root", "path": "api/skills", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.skills-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.skills.validate": { "id": "routes/api.skills.validate", "parentId": "root", "path": "api/skills/validate", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.skills.validate-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.skills.install": { "id": "routes/api.skills.install", "parentId": "root", "path": "api/skills/install", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.skills.install-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.skills.$id": { "id": "routes/api.skills.$id", "parentId": "root", "path": "api/skills/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.skills._id-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.skills.$id.enabled": { "id": "routes/api.skills.$id.enabled", "parentId": "root", "path": "api/skills/:id/enabled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.skills._id.enabled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.logs": { "id": "routes/api.logs", "parentId": "root", "path": "api/logs", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.logs-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.logs.enabled": { "id": "routes/api.logs.enabled", "parentId": "root", "path": "api/logs/enabled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.logs.enabled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.logs.export": { "id": "routes/api.logs.export", "parentId": "root", "path": "api/logs/export", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.logs.export-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.logs.clear": { "id": "routes/api.logs.clear", "parentId": "root", "path": "api/logs/clear", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.logs.clear-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects": { "id": "routes/api.projects", "parentId": "root", "path": "api/projects", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.active": { "id": "routes/api.projects.active", "parentId": "root", "path": "api/projects/active", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects.active-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId": { "id": "routes/api.projects.$projectId", "parentId": "root", "path": "api/projects/:projectId", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId.collections": { "id": "routes/api.projects.$projectId.collections", "parentId": "root", "path": "api/projects/:projectId/collections", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId.collections-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId.documents": { "id": "routes/api.projects.$projectId.documents", "parentId": "root", "path": "api/projects/:projectId/documents", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId.documents-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId.import.url": { "id": "routes/api.projects.$projectId.import.url", "parentId": "root", "path": "api/projects/:projectId/import/url", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId.import.url-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId.import.file": { "id": "routes/api.projects.$projectId.import.file", "parentId": "root", "path": "api/projects/:projectId/import/file", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId.import.file-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId.rag.query": { "id": "routes/api.projects.$projectId.rag.query", "parentId": "root", "path": "api/projects/:projectId/rag/query", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId.rag.query-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId.runs": { "id": "routes/api.projects.$projectId.runs", "parentId": "root", "path": "api/projects/:projectId/runs", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId.runs-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$projectId.runs.$runId": { "id": "routes/api.projects.$projectId.runs.$runId", "parentId": "root", "path": "api/projects/:projectId/runs/:runId", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._projectId.runs._runId-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.chat": { "id": "routes/api.chat", "parentId": "root", "path": "api/chat", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.chat-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.debug.store": { "id": "routes/api.debug.store", "parentId": "root", "path": "api/debug/store", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.debug.store-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-15c1868e.js", "version": "15c1868e", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/_app": {
    id: "routes/_app",
    parentId: "root",
    path: void 0,
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/_app._index": {
    id: "routes/_app._index",
    parentId: "routes/_app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route2
  },
  "routes/_app.settings": {
    id: "routes/_app.settings",
    parentId: "routes/_app",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/api.health": {
    id: "routes/api.health",
    parentId: "root",
    path: "api/health",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/api.config": {
    id: "routes/api.config",
    parentId: "root",
    path: "api/config",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/api.workdir": {
    id: "routes/api.workdir",
    parentId: "root",
    path: "api/workdir",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/api.tools": {
    id: "routes/api.tools",
    parentId: "root",
    path: "api/tools",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/api.credentials": {
    id: "routes/api.credentials",
    parentId: "root",
    path: "api/credentials",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/api.credentials.$id": {
    id: "routes/api.credentials.$id",
    parentId: "root",
    path: "api/credentials/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/api.mcp.presets": {
    id: "routes/api.mcp.presets",
    parentId: "root",
    path: "api/mcp/presets",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/api.mcp.servers": {
    id: "routes/api.mcp.servers",
    parentId: "root",
    path: "api/mcp/servers",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/api.mcp.servers.$id": {
    id: "routes/api.mcp.servers.$id",
    parentId: "root",
    path: "api/mcp/servers/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/api.mcp.status": {
    id: "routes/api.mcp.status",
    parentId: "root",
    path: "api/mcp/status",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/api.mcp.tools": {
    id: "routes/api.mcp.tools",
    parentId: "root",
    path: "api/mcp/tools",
    index: void 0,
    caseSensitive: void 0,
    module: route14
  },
  "routes/api.skills": {
    id: "routes/api.skills",
    parentId: "root",
    path: "api/skills",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/api.skills.validate": {
    id: "routes/api.skills.validate",
    parentId: "root",
    path: "api/skills/validate",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "routes/api.skills.install": {
    id: "routes/api.skills.install",
    parentId: "root",
    path: "api/skills/install",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "routes/api.skills.$id": {
    id: "routes/api.skills.$id",
    parentId: "root",
    path: "api/skills/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "routes/api.skills.$id.enabled": {
    id: "routes/api.skills.$id.enabled",
    parentId: "root",
    path: "api/skills/:id/enabled",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "routes/api.logs": {
    id: "routes/api.logs",
    parentId: "root",
    path: "api/logs",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "routes/api.logs.enabled": {
    id: "routes/api.logs.enabled",
    parentId: "root",
    path: "api/logs/enabled",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "routes/api.logs.export": {
    id: "routes/api.logs.export",
    parentId: "root",
    path: "api/logs/export",
    index: void 0,
    caseSensitive: void 0,
    module: route22
  },
  "routes/api.logs.clear": {
    id: "routes/api.logs.clear",
    parentId: "root",
    path: "api/logs/clear",
    index: void 0,
    caseSensitive: void 0,
    module: route23
  },
  "routes/api.projects": {
    id: "routes/api.projects",
    parentId: "root",
    path: "api/projects",
    index: void 0,
    caseSensitive: void 0,
    module: route24
  },
  "routes/api.projects.active": {
    id: "routes/api.projects.active",
    parentId: "root",
    path: "api/projects/active",
    index: void 0,
    caseSensitive: void 0,
    module: route25
  },
  "routes/api.projects.$projectId": {
    id: "routes/api.projects.$projectId",
    parentId: "root",
    path: "api/projects/:projectId",
    index: void 0,
    caseSensitive: void 0,
    module: route26
  },
  "routes/api.projects.$projectId.collections": {
    id: "routes/api.projects.$projectId.collections",
    parentId: "root",
    path: "api/projects/:projectId/collections",
    index: void 0,
    caseSensitive: void 0,
    module: route27
  },
  "routes/api.projects.$projectId.documents": {
    id: "routes/api.projects.$projectId.documents",
    parentId: "root",
    path: "api/projects/:projectId/documents",
    index: void 0,
    caseSensitive: void 0,
    module: route28
  },
  "routes/api.projects.$projectId.import.url": {
    id: "routes/api.projects.$projectId.import.url",
    parentId: "root",
    path: "api/projects/:projectId/import/url",
    index: void 0,
    caseSensitive: void 0,
    module: route29
  },
  "routes/api.projects.$projectId.import.file": {
    id: "routes/api.projects.$projectId.import.file",
    parentId: "root",
    path: "api/projects/:projectId/import/file",
    index: void 0,
    caseSensitive: void 0,
    module: route30
  },
  "routes/api.projects.$projectId.rag.query": {
    id: "routes/api.projects.$projectId.rag.query",
    parentId: "root",
    path: "api/projects/:projectId/rag/query",
    index: void 0,
    caseSensitive: void 0,
    module: route31
  },
  "routes/api.projects.$projectId.runs": {
    id: "routes/api.projects.$projectId.runs",
    parentId: "root",
    path: "api/projects/:projectId/runs",
    index: void 0,
    caseSensitive: void 0,
    module: route32
  },
  "routes/api.projects.$projectId.runs.$runId": {
    id: "routes/api.projects.$projectId.runs.$runId",
    parentId: "root",
    path: "api/projects/:projectId/runs/:runId",
    index: void 0,
    caseSensitive: void 0,
    module: route33
  },
  "routes/api.chat": {
    id: "routes/api.chat",
    parentId: "root",
    path: "api/chat",
    index: void 0,
    caseSensitive: void 0,
    module: route34
  },
  "routes/api.debug.store": {
    id: "routes/api.debug.store",
    parentId: "root",
    path: "api/debug/store",
    index: void 0,
    caseSensitive: void 0,
    module: route35
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
