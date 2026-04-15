import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MessageTupleManager, StreamManager } from '~/lib/langgraph-stream';

type StreamMessage = {
  id?: string;
  type: string;
  content: unknown;
  tool_calls?: unknown[];
  additional_kwargs?: Record<string, unknown>;
};

type RuntimeStatePayload = {
  thread?: {
    thread_id?: string;
    current_run_id?: string | null;
  };
  values?: Record<string, unknown>;
  run?: {
    id?: string;
    status?: string;
  };
};

type StreamSubmitOptions = {
  command?: { resume?: Record<string, unknown> | unknown };
  metadata?: Record<string, unknown>;
  optimisticValues?: (previous: Record<string, unknown>) => Record<string, unknown>;
};

type UseAnalystStreamOptions = {
  apiUrl: string;
  threadId?: string;
  onThreadId?: (threadId: string) => void;
  onCreated?: (meta: { thread_id: string; run_id: string }) => void;
};

type StreamSnapshot = {
  values: Record<string, unknown> | null;
  error?: unknown;
  isLoading: boolean;
  version: number;
};

type SubagentCollection =
  | Map<string, unknown>
  | {
      values?: () => IterableIterator<unknown>;
    }
  | unknown[];

function getMessages(values: Record<string, unknown>): StreamMessage[] {
  return Array.isArray(values.messages)
    ? values.messages.filter((message): message is StreamMessage => !!message && typeof message === 'object')
    : [];
}

function setMessages(current: Record<string, unknown>, messages: unknown[]) {
  return {
    ...current,
    messages,
  };
}

function normalizeValues(values: unknown): Record<string, unknown> {
  return values && typeof values === 'object' ? (values as Record<string, unknown>) : {};
}

function normalizeSnapshotValues(values: unknown): Record<string, unknown> {
  if (Array.isArray(values)) {
    return normalizeValues(values[0]);
  }
  return normalizeValues(values);
}

function normalizeSubagentList(value: SubagentCollection | unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return Array.from(value.values());
  if (value && typeof value === 'object' && typeof (value as { values?: () => IterableIterator<unknown> }).values === 'function') {
    return Array.from((value as { values: () => IterableIterator<unknown> }).values());
  }
  return [];
}

async function* readSse(url: string, signal: AbortSignal): AsyncGenerator<{ event: string; data: unknown }> {
  const response = await fetch(url, {
    headers: { Accept: 'text/event-stream' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Run stream failed: ${response.status}`);
  }
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const takeNextEventChunk = () => {
    const separators = ['\r\n\r\n', '\n\n', '\r\r'];
    let nextIndex = -1;
    let nextSeparator = '';

    for (const separator of separators) {
      const index = buffer.indexOf(separator);
      if (index === -1) continue;
      if (nextIndex === -1 || index < nextIndex) {
        nextIndex = index;
        nextSeparator = separator;
      }
    }

    if (nextIndex === -1) return null;

    const chunk = buffer.slice(0, nextIndex);
    buffer = buffer.slice(nextIndex + nextSeparator.length);
    return chunk;
  };

  const parseFieldValue = (line: string) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return '';
    const raw = line.slice(separatorIndex + 1);
    return raw.startsWith(' ') ? raw.slice(1) : raw;
  };

  const emitChunk = (chunk: string) => {
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of chunk.split(/\r\n|\n|\r/)) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = parseFieldValue(line).trim() || 'message';
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(parseFieldValue(line));
      }
    }

    if (dataLines.length === 0) return null;
    const dataText = dataLines.join('\n');
    return {
      event: eventName,
      data: JSON.parse(dataText),
    };
  };

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
    } else {
      buffer += decoder.decode(value, { stream: true });
    }

    let chunk = takeNextEventChunk();
    while (chunk !== null) {
      const parsed = emitChunk(chunk);
      if (parsed) yield parsed;
      chunk = takeNextEventChunk();
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const parsed = emitChunk(buffer);
    if (parsed) yield parsed;
  }
}

export function useAnalystStream(opts: UseAnalystStreamOptions) {
  const [messageManager] = useState(() => new MessageTupleManager());
  const [streamManager] = useState(
    () =>
      new StreamManager(messageManager, {
        throttle: 32,
        subagentToolNames: ['task'],
        filterSubagentMessages: true,
      })
  );
  const snapshot = useSyncExternalStore(
    streamManager.subscribe,
    streamManager.getSnapshot,
    streamManager.getSnapshot
  ) as StreamSnapshot;
  const [isThreadLoading, setIsThreadLoading] = useState(Boolean(opts.threadId));
  const [threadError, setThreadError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const initialValuesRef = useRef<Record<string, unknown>>({});
  const threadIdRef = useRef<string | undefined>(opts.threadId);

  const connectToRun = useCallback(
    async (threadId: string, runId: string) => {
      setActiveRunId(runId);
      try {
        await streamManager.start(
          async (signal: AbortSignal) =>
            readSse(`${opts.apiUrl}/threads/${threadId}/runs/${runId}/events/stream`, signal),
          {
            getMessages,
            setMessages,
            initialValues: initialValuesRef.current,
            callbacks: {
              onError: (error: unknown) => {
                setThreadError(error instanceof Error ? error.message : String(error));
              },
            },
            onSuccess: async () => undefined,
          },
          { abortPrevious: true }
        );
      } finally {
        try {
          const response = await fetch(`${opts.apiUrl}/threads/${threadId}/state`, {
            headers: { Accept: 'application/json' },
          });
          if (response.ok) {
            const payload = (await response.json()) as RuntimeStatePayload;
            const nextValues = normalizeValues(payload.values);
            initialValuesRef.current = nextValues;
            streamManager.setStreamValues(nextValues, 'history');
            const historyMessages = getMessages(nextValues);
            if (historyMessages.length > 0) {
              streamManager.reconstructSubagents(historyMessages, { skipIfPopulated: false });
            }
          }
        } catch (error) {
          setThreadError(error instanceof Error ? error.message : String(error));
        }
        setActiveRunId(null);
      }
    },
    [opts.apiUrl, streamManager]
  );

  const refreshState = useCallback(
    async (threadId: string) => {
      setIsThreadLoading(true);
      setThreadError(null);
      try {
        const response = await fetch(`${opts.apiUrl}/threads/${threadId}/state`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`Failed to load thread state: ${response.status}`);
        }
        const payload = (await response.json()) as RuntimeStatePayload;
        const nextValues = normalizeValues(payload.values);
        initialValuesRef.current = nextValues;
        streamManager.setStreamValues(nextValues, 'history');
        const historyMessages = getMessages(nextValues);
        if (historyMessages.length > 0) {
          streamManager.reconstructSubagents(historyMessages, { skipIfPopulated: false });
        }

        const nextRunId =
          typeof payload.run?.id === 'string' && payload.run.id.trim() ? payload.run.id.trim() : null;
        const nextRunStatus = String(payload.run?.status || '').trim().toLowerCase();
        setActiveRunId(nextRunId);
        if (nextRunId && (nextRunStatus === 'queued' || nextRunStatus === 'running')) {
          void connectToRun(threadId, nextRunId);
        }
      } catch (nextError) {
        setThreadError(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        setIsThreadLoading(false);
      }
    },
    [connectToRun, opts.apiUrl, streamManager]
  );

  useEffect(() => {
    threadIdRef.current = opts.threadId;
    streamManager.clear();
    initialValuesRef.current = {};
    setActiveRunId(null);
    setThreadError(null);

    if (!opts.threadId) {
      setIsThreadLoading(false);
      return;
    }

    void refreshState(opts.threadId);
  }, [opts.threadId, refreshState, streamManager]);

  const submit = useCallback(
    async (input: Record<string, unknown> | null, options?: StreamSubmitOptions) => {
      const threadId = threadIdRef.current;
      if (!threadId) {
        throw new Error('A thread must exist before submitting a runtime run.');
      }

      if (options?.optimisticValues) {
        const nextValues = options.optimisticValues(normalizeSnapshotValues(snapshot.values));
        initialValuesRef.current = nextValues;
        streamManager.setStreamValues(nextValues, 'stream');
      }

      const response = await fetch(`${opts.apiUrl}/threads/${threadId}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          input: input || {},
          command: options?.command,
          metadata: options?.metadata,
        }),
      });
      if (!response.ok) {
        throw new Error(`Run creation failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { run_id?: unknown; thread_id?: unknown };
      const runId =
        typeof payload.run_id === 'string' && payload.run_id.trim() ? payload.run_id.trim() : '';
      const returnedThreadId =
        typeof payload.thread_id === 'string' && payload.thread_id.trim()
          ? payload.thread_id.trim()
          : threadId;
      if (!runId) {
        throw new Error('Runtime did not return a run id.');
      }
      if (returnedThreadId !== threadId) {
        opts.onThreadId?.(returnedThreadId);
      }
      opts.onCreated?.({ thread_id: returnedThreadId, run_id: runId });
      await connectToRun(returnedThreadId, runId);
    },
    [connectToRun, opts, snapshot.values, streamManager]
  );

  const stop = useCallback(async () => {
    const threadId = threadIdRef.current;
    if (!threadId || !activeRunId) {
      return;
    }
    await fetch(`${opts.apiUrl}/threads/${threadId}/runs/${activeRunId}/cancel`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
  }, [activeRunId, opts.apiUrl]);

  const values = normalizeSnapshotValues(snapshot.values);
  const messages = getMessages(values);
  const interrupts = useMemo(
    () =>
      Array.isArray(values.__interrupt__)
        ? values.__interrupt__
        : Array.isArray(values.interrupts)
          ? values.interrupts
          : [],
    [values.__interrupt__, values.interrupts]
  );
  const subagents = normalizeSubagentList(streamManager.getSubagents());
  const activeSubagents = normalizeSubagentList(streamManager.getActiveSubagents());

  return useMemo(
    () => ({
      messages,
      values,
      interrupts,
      interrupt: Array.isArray(interrupts) && interrupts.length > 0 ? interrupts[0] : null,
      activeSubagents,
      subagents,
      error:
        threadError ||
        (snapshot.error instanceof Error ? snapshot.error.message : snapshot.error ? String(snapshot.error) : null),
      isLoading: snapshot.isLoading,
      isThreadLoading,
      submit,
      stop,
      getSubagentsByMessage: (messageId: string) => streamManager.getSubagentsByMessage(messageId),
    }),
    [
      activeSubagents,
      interrupts,
      isThreadLoading,
      messages,
      snapshot.error,
      snapshot.isLoading,
      stop,
      streamManager,
      submit,
      subagents,
      threadError,
      values,
    ]
  );
}
