import { useStream, type UseDeepAgentStream } from '@langchain/langgraph-sdk/react';

/**
 * Wraps the LangGraph `useStream` hook for the Open Analyst deep agent.
 *
 * Connects directly to the LangGraph Agent Server,
 * with subagent tracking, interrupt handling, and message filtering.
 */
export function useAnalystStream(opts: {
  apiUrl: string;
  threadId?: string;
  onThreadId?: (threadId: string) => void;
  onCreated?: (meta: { thread_id: string; run_id: string }) => void;
}) {
  // The SDK exposes filterSubagentMessages and subagentToolNames on
  // AnyStreamOptions (internal type). They're read by StreamManager at
  // runtime, so a type assertion is the practical approach.
  const stream = useStream({
    assistantId: 'open-analyst',
    apiUrl: opts.apiUrl,
    threadId: opts.threadId,
    onThreadId: opts.onThreadId,
    onCreated: opts.onCreated,
    fetchStateHistory: { limit: 1 },
    throttle: 32,
    filterSubagentMessages: true,
    subagentToolNames: ['task'],
    // Rejoin in-progress runs when navigating back to a thread
    reconnectOnMount: true,
  } as unknown as Parameters<typeof useStream>[0]) as UseDeepAgentStream;

  return stream;
}
