import type { HeadlessConfig } from "./types";
import { createAgentProvider } from "./agent/index.server";
import { getProjectWorkspace } from "./filesystem.server";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatOptions {
  projectId?: string;
  collectionId?: string;
  collectionName?: string;
  deepResearch?: boolean;
  onRunEvent?: (eventType: string, payload: Record<string, unknown>) => void;
}

interface ChatResult {
  text: string;
  traces: unknown[];
  toolCalls: unknown[];
}

export async function runAgentChat(
  config: HeadlessConfig,
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResult> {
  const provider = createAgentProvider(config);
  const projectId = options.projectId || "";
  const workingDir = projectId
    ? getProjectWorkspace(projectId)
    : config.workingDir || process.cwd();

  try {
    const result = await provider.chat(
      messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      {
        projectId,
        workingDir,
        collectionId: options.collectionId,
        collectionName: options.collectionName || "Task Sources",
        deepResearch: options.deepResearch,
      }
    );

    return { text: result.text, traces: result.traces, toolCalls: [] };
  } finally {
    await provider.dispose?.();
  }
}
