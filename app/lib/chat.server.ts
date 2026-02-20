// Stub for chat agent logic — delegates to the original headless server's
// runAgentChat. The full port of tool handlers (web_fetch, web_search,
// arxiv_search, etc.) will be done in a later phase.
//
// For now this module just re-exports a compatible interface.

import type { HeadlessConfig } from "./types";

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
  _config: HeadlessConfig,
  _messages: ChatMessage[],
  _options: ChatOptions = {}
): Promise<ChatResult> {
  // TODO: Port tool handlers and OpenAI SDK integration
  // For now, return a placeholder indicating the chat endpoint is wired up
  // but the agent loop is not yet available in the RR7 app.
  return {
    text: "Chat endpoint is connected but the agent loop has not been ported to RR7 yet.",
    traces: [],
    toolCalls: [],
  };
}
