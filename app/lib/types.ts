// Re-export all types from the renderer types
// Server-specific additions are below

export type {
  Session,
  SessionStatus,
  MountedPath,
  Message,
  MessageRole,
  ContentBlock,
  TextContent,
  ImageContent,
  FileAttachmentContent,
  ToolUseContent,
  ToolResultContent,
  ThinkingContent,
  TokenUsage,
  TraceStep,
  TraceStepType,
  TraceStepStatus,
  Skill,
  SkillType,
  MemoryEntry,
  MemoryMetadata,
  PermissionRequest,
  PermissionResult,
  QuestionOption,
  QuestionItem,
  UserQuestionRequest,
  UserQuestionResponse,
  PermissionRule,
  ClientEvent,
  SandboxSetupPhase,
  SandboxSetupProgress,
  SandboxSyncPhase,
  SandboxSyncStatus,
  ServerEvent,
  Settings,
  ToolName,
  ToolResult,
  ExecutionContext,
  AppConfig,
  ProviderPreset,
  ProviderPresets,
  ApiTestInput,
  ApiTestResult,
  MCPServerInfo,
  MCPToolInfo,
} from "@renderer/types/index";

// Server-specific types

export interface Credential {
  id: string;
  name: string;
  type: "email" | "website" | "api" | "other";
  service?: string;
  username: string;
  password?: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
}

export interface McpPreset {
  name: string;
  type: "stdio" | "sse";
  command: string;
  args: string[];
  requiresEnv: string[];
  env: Record<string, string>;
}

export interface HeadlessConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  bedrockRegion: string;
  model: string;
  openaiMode: string;
  workingDir: string;
  workingDirType: string;
  s3Uri: string;
  activeProjectId: string;
  devLogsEnabled?: boolean;
  [key: string]: unknown;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  datastores: Datastore[];
  collections: Collection[];
  documents: Document[];
  runs: Run[];
}

export interface Datastore {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  isDefault?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface Document {
  id: string;
  collectionId: string | null;
  title: string;
  sourceType: string;
  sourceUri: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Run {
  id: string;
  type: string;
  status: string;
  prompt: string;
  output: string;
  events: RunEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface RunEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ProjectStore {
  version: number;
  activeProjectId: string;
  projects: ProjectData[];
}

export interface RagResult {
  id: string;
  title: string;
  sourceUri: string;
  score: number;
  snippet: string;
  metadata: Record<string, unknown>;
}

export interface RagQueryResult {
  query: string;
  queryVariants: string[];
  totalCandidates: number;
  results: RagResult[];
}

export interface ToolDefinition {
  name: string;
  description: string;
}

export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  type: "builtin" | "custom";
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: number;
}
