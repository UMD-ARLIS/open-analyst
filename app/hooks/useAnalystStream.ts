import { useMemo } from "react";
import { useStream, type UseDeepAgentStream } from "@langchain/langgraph-sdk/react";

/**
 * Wraps the LangGraph `useStream` hook for the Open Analyst deep agent.
 *
 * Connects to the Agent Server via the web app proxy at `/api/runtime`,
 * with subagent tracking, interrupt handling, and message filtering.
 */
export function useAnalystStream(opts: {
  threadId?: string;
  onThreadId?: (threadId: string) => void;
  onCreated?: (meta: { thread_id: string; run_id: string }) => void;
}) {
  const apiUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/runtime`;
    }
    return "http://localhost:5173/api/runtime";
  }, []);

  // The SDK exposes filterSubagentMessages and subagentToolNames on
  // AnyStreamOptions (internal type). They're read by StreamManager at
  // runtime, so a type assertion is the practical approach.
  const stream = useStream({
    assistantId: "open-analyst",
    apiUrl,
    threadId: opts.threadId,
    onThreadId: opts.onThreadId,
    onCreated: opts.onCreated,
    fetchStateHistory: { limit: false },
    filterSubagentMessages: true,
    subagentToolNames: ["task"],
    // Rejoin in-progress runs when navigating back to a thread
    reconnectOnMount: true,
  } as unknown as Parameters<typeof useStream>[0]) as UseDeepAgentStream;

  return stream;
}
