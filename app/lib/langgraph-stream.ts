import {
  AIMessageChunk,
  HumanMessageChunk,
  RemoveMessage,
  SystemMessageChunk,
  ToolMessageChunk,
  coerceMessageLikeToMessage,
  convertToChunk,
  isBaseMessageChunk,
} from '@langchain/core/messages';

type MessageLike = Record<string, unknown>;
type MessageMetadata = Record<string, unknown> | undefined;
type StreamState = {
  isLoading: boolean;
  values: [Record<string, unknown>, 'stream' | 'history' | 'stop'] | null;
  error?: unknown;
  version: number;
};

function tryConvertToChunk(message: unknown) {
  try {
    if (isBaseMessageChunk(message)) return message;
    return convertToChunk(message);
  } catch {
    return null;
  }
}

function tryCoerceMessageLikeToMessage(message: MessageLike) {
  if (message.type === 'human' || message.type === 'user') return new HumanMessageChunk(message);
  if (message.type === 'ai' || message.type === 'assistant') return new AIMessageChunk(message);
  if (message.type === 'system') return new SystemMessageChunk(message);
  if (message.type === 'tool' && 'tool_call_id' in message) {
    return new ToolMessageChunk({
      ...message,
      tool_call_id: String(message.tool_call_id || ''),
    });
  }
  if (message.type === 'remove' && message.id != null) {
    return new RemoveMessage({
      ...message,
      id: String(message.id),
    });
  }
  return coerceMessageLikeToMessage(message);
}

function toMessageDict(chunk: { toDict: () => { type: string; data: Record<string, unknown> } }) {
  const { type, data } = chunk.toDict();
  return {
    ...data,
    type,
  };
}

type MessageChunkEntry = {
  chunk?: {
    id?: string | null;
    getType?: () => string;
    concat?: (other: unknown) => unknown;
    toDict?: () => { type: string; data: Record<string, unknown> };
  } | null;
  metadata?: MessageMetadata;
  index?: number;
};

export class MessageTupleManager {
  chunks: Record<string, MessageChunkEntry> = {};

  add(serialized: MessageLike, metadata?: MessageMetadata) {
    if (typeof serialized.type === 'string' && serialized.type.endsWith('MessageChunk')) {
      serialized.type = serialized.type.slice(0, -12).toLowerCase();
    }

    const message = tryCoerceMessageLikeToMessage(serialized);
    const chunk = tryConvertToChunk(message);
    const id = (chunk as { id?: string | null } | null)?.id || (message as { id?: string | null }).id;
    if (!id) return null;

    this.chunks[id] ??= {};
    this.chunks[id].metadata = metadata ?? this.chunks[id].metadata;
    if (chunk) {
      const previous = this.chunks[id].chunk;
      this.chunks[id].chunk =
        previous && isBaseMessageChunk(previous) && typeof previous.concat === 'function'
          ? previous.concat(chunk)
          : chunk;
    } else {
      this.chunks[id].chunk = message as MessageChunkEntry['chunk'];
    }
    return id;
  }

  clear() {
    this.chunks = {};
  }

  get(id: string | null | undefined, defaultIndex?: number) {
    if (!id || !this.chunks[id]) return null;
    if (defaultIndex != null) this.chunks[id].index ??= defaultIndex;
    return this.chunks[id];
  }
}

function computeToolCallState(result: MessageLike | undefined, impliedCompleted: boolean) {
  if (result) {
    const content = normalizeToolResultContent(result.content).trim().toLowerCase();
    const isImplicitError =
      result.status === 'error' ||
      content.startsWith('the model provider is temporarily unavailable') ||
      content.startsWith('the model provider is temporarily rate limited');
    return isImplicitError ? 'error' : 'completed';
  }
  if (impliedCompleted) return 'completed';
  return 'pending';
}

function normalizeToolResultContent(content: unknown) {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? '');
  }
}

function getToolCallsWithResults(messages: MessageLike[]) {
  const results: Array<Record<string, unknown>> = [];
  const toolResultsById = new Map<string, MessageLike>();
  const inferredToolResultsById = new Map<string, MessageLike>();
  const pendingSubagentToolCallIds: string[] = [];

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex];
    if (message.type === 'ai' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      for (const call of message.tool_calls) {
        const typedCall = (call || {}) as { id?: string; name?: string };
        if (typedCall.id && typedCall.name === 'task') {
          pendingSubagentToolCallIds.push(typedCall.id);
        }
      }
    }
    if (message.type === 'tool' && typeof message.tool_call_id === 'string') {
      toolResultsById.set(message.tool_call_id, message);
      continue;
    }
    if (message.type === 'tool' && pendingSubagentToolCallIds.length > 0) {
      const nextToolCallId = pendingSubagentToolCallIds.shift();
      if (nextToolCallId) {
        inferredToolResultsById.set(nextToolCallId, message);
      }
    }
  }

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex];
    if (message.type !== 'ai' || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      continue;
    }

    let impliedCompleted = false;
    for (let idx = messageIndex + 1; idx < messages.length; idx += 1) {
      if (messages[idx].type === 'ai') {
        impliedCompleted = true;
        break;
      }
    }

    message.tool_calls.forEach((call, index) => {
      const typedCall = (call || {}) as { id?: string; name?: string; args?: Record<string, unknown> };
      const result = typedCall.id
        ? toolResultsById.get(typedCall.id) ?? inferredToolResultsById.get(typedCall.id)
        : undefined;
      results.push({
        id: typedCall.id ?? `${String(message.id || 'unknown')}-${index}`,
        call: typedCall,
        result,
        aiMessage: message,
        index,
        state: computeToolCallState(result, impliedCompleted),
      });
    });
  }

  return results;
}

export function isSubagentNamespace(namespace: string[] | string | undefined) {
  if (!namespace) return false;
  if (typeof namespace === 'string') return namespace.includes('tools:');
  return namespace.some((segment) => segment.startsWith('tools:'));
}

export function extractToolCallIdFromNamespace(namespace: string[] | undefined) {
  if (!namespace || namespace.length === 0) return undefined;
  for (const segment of namespace) {
    if (segment.startsWith('tools:')) return segment.slice(6);
  }
  return undefined;
}

function calculateDepthFromNamespace(namespace: string[] | undefined) {
  if (!namespace) return 0;
  return namespace.filter((segment) => segment.startsWith('tools:')).length;
}

function extractParentIdFromNamespace(namespace: string[] | undefined) {
  if (!namespace || namespace.length < 2) return null;
  const toolSegments = namespace.filter((segment) => segment.startsWith('tools:'));
  if (toolSegments.length < 2) return null;
  return toolSegments[toolSegments.length - 2]?.slice(6) ?? null;
}

type SubagentExecution = {
  id: string;
  toolCall: {
    id: string;
    name?: string;
    args: Record<string, unknown>;
  };
  status: string;
  values: Record<string, unknown>;
  result: string | null;
  error: string | null;
  namespace: string[];
  messages: MessageLike[];
  aiMessageId: string | null;
  parentId: string | null;
  depth: number;
  startedAt: Date | null;
  completedAt: Date | null;
};

type BuiltSubagentStream = SubagentExecution & {
  isLoading: boolean;
  toolCalls: Array<Record<string, unknown>>;
  getToolCalls: (message: MessageLike) => Array<Record<string, unknown>>;
  interrupt: undefined;
  interrupts: unknown[];
  switchThread: () => void;
  subagents: Map<string, unknown>;
  activeSubagents: unknown[];
  getSubagent: () => undefined;
  getSubagentsByType: () => unknown[];
  getSubagentsByMessage: () => unknown[];
};

export class SubagentManager {
  private readonly subagents = new Map<string, SubagentExecution>();
  private readonly namespaceToToolCallId = new Map<string, string>();
  private readonly pendingMatches = new Map<string, string>();
  private readonly messageManagers = new Map<string, MessageTupleManager>();
  private readonly subagentToolNames: Set<string>;
  private readonly onSubagentChange?: () => void;

  constructor(options?: { subagentToolNames?: string[]; onSubagentChange?: () => void }) {
    this.subagentToolNames = new Set(options?.subagentToolNames ?? ['task']);
    this.onSubagentChange = options?.onSubagentChange;
  }

  private getMessageManager(toolCallId: string) {
    let manager = this.messageManagers.get(toolCallId);
    if (!manager) {
      manager = new MessageTupleManager();
      this.messageManagers.set(toolCallId, manager);
    }
    return manager;
  }

  private getMessagesForSubagent(toolCallId: string) {
    const manager = this.messageManagers.get(toolCallId);
    if (!manager) return [];
    const messages: MessageLike[] = [];
    for (const entry of Object.values(manager.chunks)) {
      if (entry.chunk && typeof entry.chunk.toDict === 'function') {
        messages.push(toMessageDict(entry.chunk));
      }
    }
    return messages;
  }

  private createSubagentStream(base: SubagentExecution): BuiltSubagentStream {
    const messages = base.messages;
    const allToolCalls = getToolCallsWithResults(messages);
    return {
      ...base,
      isLoading: base.status === 'running',
      toolCalls: allToolCalls,
      getToolCalls: (message: MessageLike) => allToolCalls.filter((item) => item.aiMessage?.id === message.id),
      interrupt: undefined,
      interrupts: [],
      switchThread: () => {},
      subagents: new Map(),
      activeSubagents: [],
      getSubagent: () => undefined,
      getSubagentsByType: () => [],
      getSubagentsByMessage: () => [],
    };
  }

  private getToolCallIdFromNamespace(namespaceId: string) {
    return this.namespaceToToolCallId.get(namespaceId) ?? namespaceId;
  }

  private isSubagentToolCall(toolName: unknown) {
    return this.subagentToolNames.has(String(toolName || ''));
  }

  private isValidSubagentType(type: unknown) {
    const value = String(type || '');
    return /^[a-zA-Z][a-zA-Z0-9_-]{2,49}$/.test(value);
  }

  private isValidSubagent(subagent: SubagentExecution) {
    return subagent.status === 'running' || subagent.status === 'complete' || subagent.status === 'error';
  }

  private parseArgs(args: unknown) {
    if (!args) return {};
    if (typeof args === 'string') {
      try {
        return JSON.parse(args) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return typeof args === 'object' ? ({ ...(args as Record<string, unknown>) } as Record<string, unknown>) : {};
  }

  private retryPendingMatches() {
    if (this.pendingMatches.size === 0) return;
    for (const [namespaceId, description] of this.pendingMatches) {
      if (this.namespaceToToolCallId.has(namespaceId)) {
        this.pendingMatches.delete(namespaceId);
        continue;
      }
      if (this.matchSubgraphToSubagent(namespaceId, description)) {
        this.pendingMatches.delete(namespaceId);
      }
    }
  }

  matchSubgraphToSubagent(namespaceId: string, description: string) {
    if (this.namespaceToToolCallId.has(namespaceId)) {
      return this.namespaceToToolCallId.get(namespaceId);
    }

    const mappedToolCallIds = new Set(this.namespaceToToolCallId.values());
    const establishMapping = (toolCallId: string) => {
      this.namespaceToToolCallId.set(namespaceId, toolCallId);
      const subagent = this.subagents.get(toolCallId);
      if (subagent && subagent.status === 'pending') {
        this.subagents.set(toolCallId, {
          ...subagent,
          status: 'running',
          namespace: [namespaceId],
          startedAt: new Date(),
        });
        this.onSubagentChange?.();
      }
      return toolCallId;
    };

    for (const [toolCallId, subagent] of this.subagents) {
      if ((subagent.status === 'pending' || subagent.status === 'running') && !mappedToolCallIds.has(toolCallId) && subagent.toolCall.args.description === description) {
        return establishMapping(toolCallId);
      }
    }

    for (const [toolCallId, subagent] of this.subagents) {
      if ((subagent.status === 'pending' || subagent.status === 'running') && !mappedToolCallIds.has(toolCallId)) {
        const subagentDescription = String(subagent.toolCall.args.description || '');
        if (
          subagentDescription &&
          (description.includes(subagentDescription) || subagentDescription.includes(description))
        ) {
          return establishMapping(toolCallId);
        }
      }
    }

    if (description) this.pendingMatches.set(namespaceId, description);
    return undefined;
  }

  registerFromToolCalls(toolCalls: unknown[], aiMessageId?: string | null) {
    let hasChanges = false;
    for (const toolCall of toolCalls) {
      const typedCall = (toolCall || {}) as { id?: string; name?: string; args?: unknown };
      if (!typedCall.id || !this.isSubagentToolCall(typedCall.name)) continue;
      const parsedArgs = this.parseArgs(typedCall.args);
      const hasValidType = this.isValidSubagentType(parsedArgs.subagent_type);
      const existing = this.subagents.get(typedCall.id);

      if (existing) {
        const nextType = String(parsedArgs.subagent_type || '');
        const nextDescription = String(parsedArgs.description || '');
        const previousType = String(existing.toolCall.args.subagent_type || '');
        const previousDescription = String(existing.toolCall.args.description || '');
        const shouldUpdateType = this.isValidSubagentType(nextType) && nextType.length > previousType.length;
        const shouldUpdateDescription = nextDescription.length > previousDescription.length;
        const shouldUpdateMessageId = aiMessageId != null && aiMessageId !== existing.aiMessageId;

        if (shouldUpdateType || shouldUpdateDescription || shouldUpdateMessageId) {
          this.subagents.set(typedCall.id, {
            ...existing,
            ...(shouldUpdateMessageId ? { aiMessageId } : {}),
            toolCall: {
              ...existing.toolCall,
              args: {
                ...existing.toolCall.args,
                ...parsedArgs,
                description: shouldUpdateDescription ? nextDescription : previousDescription,
                subagent_type: shouldUpdateType ? nextType : previousType,
              },
            },
          });
          hasChanges = true;
        }
        continue;
      }

      if (!hasValidType) continue;
      this.subagents.set(typedCall.id, {
        id: typedCall.id,
        toolCall: {
          id: typedCall.id,
          name: typedCall.name,
          args: {
            description: parsedArgs.description,
            subagent_type: parsedArgs.subagent_type,
            ...parsedArgs,
          },
        },
        status: 'pending',
        values: {},
        result: null,
        error: null,
        namespace: [],
        messages: [],
        aiMessageId: aiMessageId ?? null,
        parentId: null,
        depth: 0,
        startedAt: null,
        completedAt: null,
      });
      this.getMessageManager(typedCall.id);
      hasChanges = true;
    }

    if (hasChanges) {
      this.retryPendingMatches();
      this.onSubagentChange?.();
    }
  }

  markRunningFromNamespace(namespaceId: string, namespace: string[]) {
    const toolCallId = this.getToolCallIdFromNamespace(namespaceId);
    const existing = this.subagents.get(toolCallId);
    if (!existing) return;
    this.subagents.set(toolCallId, {
      ...existing,
      status: 'running',
      namespace,
      parentId: existing.parentId ?? extractParentIdFromNamespace(namespace),
      depth: existing.depth || calculateDepthFromNamespace(namespace),
      startedAt: existing.startedAt ?? new Date(),
    });
    this.onSubagentChange?.();
  }

  addMessageToSubagent(namespaceId: string, serialized: MessageLike, metadata?: MessageMetadata) {
    if (serialized.type === 'human' && typeof serialized.content === 'string') {
      this.matchSubgraphToSubagent(namespaceId, serialized.content);
    }
    const toolCallId = this.getToolCallIdFromNamespace(namespaceId);
    const existing = this.subagents.get(toolCallId);
    if (!existing) return;

    if (this.getMessageManager(toolCallId).add(serialized, metadata)) {
      this.subagents.set(toolCallId, {
        ...existing,
        status: serialized.type === 'ai' ? 'running' : existing.status,
        startedAt: existing.startedAt ?? new Date(),
        messages: this.getMessagesForSubagent(toolCallId),
      });
      this.onSubagentChange?.();
    }
  }

  updateSubagentValues(namespaceId: string, values: Record<string, unknown>) {
    const toolCallId = this.getToolCallIdFromNamespace(namespaceId);
    const existing = this.subagents.get(toolCallId);
    if (!existing) return;
    this.subagents.set(toolCallId, {
      ...existing,
      values,
      status: existing.status === 'pending' ? 'running' : existing.status,
      startedAt: existing.startedAt ?? new Date(),
    });
    this.onSubagentChange?.();
  }

  processToolMessage(toolCallId: string, content: string, status: 'success' | 'error' = 'success') {
    const existing = this.subagents.get(toolCallId);
    if (!existing) return;
    this.subagents.set(toolCallId, {
      ...existing,
      status: status === 'success' ? 'complete' : 'error',
      result: status === 'success' ? content : null,
      error: status === 'error' ? content : null,
      completedAt: new Date(),
    });
    this.onSubagentChange?.();
  }

  reconstructFromMessages(messages: MessageLike[], options?: { skipIfPopulated?: boolean }) {
    if (options?.skipIfPopulated && this.subagents.size > 0) return;
    const toolCallsWithResults = getToolCallsWithResults(messages);
    let hasChanges = false;
    for (const entry of toolCallsWithResults) {
      const typedCall = (entry.call || {}) as { id?: string; name?: string; args?: unknown };
      if (!typedCall.id || !this.isSubagentToolCall(typedCall.name)) continue;
      const parsedArgs = this.parseArgs(typedCall.args);
      if (!this.isValidSubagentType(parsedArgs.subagent_type)) continue;

      const toolResult = (entry.result || null) as MessageLike | null;
      const nextStatus =
        entry.state === 'error' ? 'error' : entry.state === 'completed' ? 'complete' : 'running';
      const nextResult =
        toolResult && nextStatus === 'complete' ? normalizeToolResultContent(toolResult.content) : null;
      const nextError =
        toolResult && nextStatus === 'error' ? normalizeToolResultContent(toolResult.content) : null;
      const existing = this.subagents.get(typedCall.id);
      const nextAiMessageId =
        entry.aiMessage && typeof (entry.aiMessage as MessageLike).id === 'string'
          ? String((entry.aiMessage as MessageLike).id)
          : null;

      if (existing) {
        const shouldUpdate =
          existing.status !== nextStatus ||
          existing.result !== nextResult ||
          existing.error !== nextError ||
          existing.aiMessageId !== nextAiMessageId;
        if (!shouldUpdate) continue;
        this.subagents.set(typedCall.id, {
          ...existing,
          status: nextStatus,
          result: nextResult,
          error: nextError,
          aiMessageId: nextAiMessageId,
          completedAt: nextStatus === 'running' ? null : existing.completedAt ?? new Date(),
        });
        hasChanges = true;
        continue;
      }

      this.subagents.set(typedCall.id, {
        id: typedCall.id,
        toolCall: {
          id: typedCall.id,
          name: typedCall.name,
          args: {
            description: parsedArgs.description,
            subagent_type: parsedArgs.subagent_type,
            ...parsedArgs,
          },
        },
        status: nextStatus,
        values: {},
        result: nextResult,
        error: nextError,
        namespace: [],
        messages: [],
        aiMessageId: nextAiMessageId,
        parentId: null,
        depth: 0,
        startedAt: null,
        completedAt: nextStatus === 'running' ? null : new Date(),
      });
      hasChanges = true;
    }

    if (hasChanges) this.onSubagentChange?.();
  }

  getSubagents() {
    const result = new Map<string, BuiltSubagentStream>();
    for (const [id, subagent] of this.subagents) {
      if (this.isValidSubagent(subagent)) {
        result.set(
          id,
          this.createSubagentStream({
            ...subagent,
            messages: this.getMessagesForSubagent(id),
          })
        );
      }
    }
    return result;
  }

  getActiveSubagents() {
    return Array.from(this.subagents.values())
      .filter((subagent) => subagent.status === 'running' && this.isValidSubagent(subagent))
      .map((subagent) =>
        this.createSubagentStream({
          ...subagent,
          messages: this.getMessagesForSubagent(subagent.id),
        })
      );
  }

  getSubagentsByMessage(messageId: string) {
    return Array.from(this.subagents.values())
      .filter((subagent) => subagent.aiMessageId === messageId && this.isValidSubagent(subagent))
      .map((subagent) =>
        this.createSubagentStream({
          ...subagent,
          messages: this.getMessagesForSubagent(subagent.id),
        })
      );
  }

  clear() {
    this.subagents.clear();
    this.namespaceToToolCallId.clear();
    this.pendingMatches.clear();
    this.messageManagers.clear();
    this.onSubagentChange?.();
  }
}

class StreamError extends Error {
  constructor(data: { message?: string; name?: string; error?: string }) {
    super(data.message);
    this.name = data.name ?? data.error ?? 'StreamError';
  }
}

type StreamManagerOptions = {
  throttle?: number | boolean;
  filterSubagentMessages?: boolean;
  subagentToolNames?: string[];
};

type StreamCallbacks = {
  onError?: (error: unknown) => void | Promise<void>;
};

export class StreamManager {
  private abortRef = new AbortController();
  private readonly messages: MessageTupleManager;
  private readonly subagentManager: SubagentManager;
  private readonly listeners = new Set<() => void>();
  private readonly throttle: number | boolean | undefined;
  private readonly filterSubagentMessages: boolean;
  private state: StreamState = {
    isLoading: false,
    values: null,
    error: undefined,
    version: 0,
  };

  constructor(messages: MessageTupleManager, options: StreamManagerOptions = {}) {
    this.messages = messages;
    this.throttle = options.throttle;
    this.filterSubagentMessages = options.filterSubagentMessages ?? false;
    this.subagentManager = new SubagentManager({
      subagentToolNames: options.subagentToolNames,
      onSubagentChange: () => this.bumpVersion(),
    });
  }

  private bumpVersion() {
    this.state = { ...this.state, version: this.state.version + 1 };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  private setState(nextState: Partial<StreamState>) {
    this.state = { ...this.state, ...nextState };
    this.notifyListeners();
  }

  private getMutateFn(
    kind: 'stream' | 'history' | 'stop',
    historyValues: Record<string, unknown>
  ) {
    return (update: Record<string, unknown> | ((previous: Record<string, unknown>) => Record<string, unknown>)) => {
      const stateValues = (this.state.values ?? [null])[0] ?? {};
      const previous = { ...historyValues, ...stateValues };
      const next = typeof update === 'function' ? update(previous) : update;
      this.setStreamValues({ ...previous, ...next }, kind);
    };
  }

  subscribe = (listener: () => void) => {
    if (this.throttle === false) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    const timeoutMs = this.throttle === true ? 0 : this.throttle ?? 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const throttled = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(listener, timeoutMs);
    };
    this.listeners.add(throttled);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      this.listeners.delete(throttled);
    };
  };

  getSnapshot = () => this.state;

  getSubagents() {
    return this.subagentManager.getSubagents();
  }

  getActiveSubagents() {
    return this.subagentManager.getActiveSubagents();
  }

  getSubagentsByMessage(messageId: string) {
    return this.subagentManager.getSubagentsByMessage(messageId);
  }

  reconstructSubagents(messages: MessageLike[], options?: { skipIfPopulated?: boolean }) {
    this.subagentManager.reconstructFromMessages(messages, options);
  }

  setStreamValues(
    values:
      | Record<string, unknown>
      | null
      | ((previous: Record<string, unknown>, kind?: 'stream' | 'history' | 'stop') => Record<string, unknown> | null),
    kind: 'stream' | 'history' | 'stop' = 'stream'
  ) {
    if (typeof values === 'function') {
      const [previousValues, previousKind] = this.state.values ?? [null, 'stream'];
      const nextValues = values(previousValues ?? {}, previousKind);
      this.setState({ values: nextValues ? [nextValues, kind] : null });
      return;
    }
    this.setState({ values: values ? [values, kind] : null });
  }

  async start(
    action: (signal: AbortSignal) => Promise<AsyncIterable<{ event: string; data: unknown }>>,
    options: {
      getMessages: (values: Record<string, unknown>) => MessageLike[];
      setMessages: (current: Record<string, unknown>, messages: unknown[]) => Record<string, unknown>;
      initialValues: Record<string, unknown>;
      callbacks?: StreamCallbacks;
      onSuccess?: () => Promise<Record<string, unknown> | undefined>;
    },
    startOptions?: { abortPrevious?: boolean }
  ) {
    if (startOptions?.abortPrevious) this.abortRef.abort();
    this.abortRef = new AbortController();
    this.setState({ isLoading: true, error: undefined });

    try {
      const run = await action(this.abortRef.signal);
      for await (const { event, data } of run) {
        if (event === 'error') {
          throw new StreamError((data || {}) as { message?: string; name?: string; error?: string });
        }

        const namespace = event.includes('|') ? event.split('|').slice(1) : undefined;
        const mutate = this.getMutateFn('stream', options.initialValues);

        if (event === 'values' || event.startsWith('values|')) {
          if (namespace && isSubagentNamespace(namespace)) {
            const namespaceId = extractToolCallIdFromNamespace(namespace);
            if (namespaceId && this.filterSubagentMessages && data && typeof data === 'object') {
              const valuesData = data as Record<string, unknown>;
              const messages = valuesData.messages;
              if (Array.isArray(messages) && messages.length > 0) {
                const firstMessage = messages[0] as Record<string, unknown>;
                if (firstMessage?.type === 'human' && typeof firstMessage.content === 'string') {
                  this.subagentManager.matchSubgraphToSubagent(namespaceId, firstMessage.content);
                }
              }
              this.subagentManager.updateSubagentValues(namespaceId, valuesData);
            }
          } else if (data && typeof data === 'object') {
            this.setStreamValues(data as Record<string, unknown>);
          }
          continue;
        }

        if (event === 'updates' || event.startsWith('updates|')) {
          if (namespace && isSubagentNamespace(namespace)) {
            const namespaceId = extractToolCallIdFromNamespace(namespace);
            if (namespaceId && this.filterSubagentMessages) {
              this.subagentManager.markRunningFromNamespace(namespaceId, namespace);
            }
          } else if (data && typeof data === 'object') {
            for (const nodeData of Object.values(data as Record<string, unknown>)) {
              if (!nodeData || typeof nodeData !== 'object' || !('messages' in nodeData)) continue;
              const messages = (nodeData as Record<string, unknown>).messages;
              if (!Array.isArray(messages)) continue;
              for (const message of messages) {
                if (!message || typeof message !== 'object') continue;
                const typedMessage = message as MessageLike;
                if (typedMessage.type === 'ai' && Array.isArray(typedMessage.tool_calls)) {
                  this.subagentManager.registerFromToolCalls(typedMessage.tool_calls, typeof typedMessage.id === 'string' ? typedMessage.id : undefined);
                }
                if (typedMessage.type === 'tool' && typeof typedMessage.tool_call_id === 'string') {
                  const content =
                    typeof typedMessage.content === 'string'
                      ? typedMessage.content
                      : JSON.stringify(typedMessage.content);
                  this.subagentManager.processToolMessage(
                    typedMessage.tool_call_id,
                    content,
                    typedMessage.status === 'error' ? 'error' : 'success'
                  );
                }
              }
            }
          }
          continue;
        }

        if (event === 'messages' || event.startsWith('messages|')) {
          const tuple = Array.isArray(data) ? data : [];
          const serialized = tuple[0];
          const metadata = tuple[1];
          if (!serialized || typeof serialized !== 'object') continue;

          const metadataRecord = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : undefined;
          const rawCheckpointNs =
            metadataRecord?.langgraph_checkpoint_ns || metadataRecord?.checkpoint_ns;
          const checkpointNs = typeof rawCheckpointNs === 'string' ? rawCheckpointNs : undefined;
          const isFromSubagent = isSubagentNamespace(checkpointNs);
          const toolCallId = isFromSubagent ? extractToolCallIdFromNamespace(checkpointNs?.split('|')) : undefined;

          if (this.filterSubagentMessages && isFromSubagent && toolCallId) {
            this.subagentManager.addMessageToSubagent(toolCallId, serialized as MessageLike, metadataRecord);
            continue;
          }

          const messageId = this.messages.add(serialized as MessageLike, metadataRecord);
          if (!messageId) continue;

          this.setStreamValues((streamValues) => {
            const values = {
              ...options.initialValues,
              ...streamValues,
            };
            const messages = options.getMessages(values).slice();
            const entry = this.messages.get(messageId, messages.length);
            const chunk = entry?.chunk;
            const index = entry?.index;
            if (!chunk || index == null || typeof chunk.toDict !== 'function') {
              return values;
            }
            const messageDict = toMessageDict(chunk);
            messages[index] = messageDict;
            if (!isFromSubagent && messageDict.type === 'ai' && Array.isArray(messageDict.tool_calls)) {
              this.subagentManager.registerFromToolCalls(messageDict.tool_calls, typeof messageDict.id === 'string' ? messageDict.id : undefined);
            }
            if (!isFromSubagent && messageDict.type === 'tool' && typeof messageDict.tool_call_id === 'string') {
              const content =
                typeof messageDict.content === 'string'
                  ? messageDict.content
                  : JSON.stringify(messageDict.content);
              this.subagentManager.processToolMessage(
                messageDict.tool_call_id,
                content,
                messageDict.status === 'error' ? 'error' : 'success'
              );
            }
            return options.setMessages(values, messages);
          });
          continue;
        }

        if ((event === 'custom' || event.startsWith('custom|')) && data && typeof data === 'object') {
          mutate(data as Record<string, unknown>);
        }
      }

      if (!this.abortRef.signal.aborted) {
        const values = await options.onSuccess?.();
        if (typeof values !== 'undefined') {
          this.setStreamValues(values);
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        this.setState({ error });
        await options.callbacks?.onError?.(error);
      }
    } finally {
      this.setState({ isLoading: false });
      this.abortRef = new AbortController();
    }
  }

  clear() {
    this.abortRef.abort();
    this.abortRef = new AbortController();
    this.setState({
      error: undefined,
      values: null,
      isLoading: false,
    });
    this.messages.clear();
    this.subagentManager.clear();
  }
}
