import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Save,
  Trash2,
} from 'lucide-react';
import { AlertDialog } from './AlertDialog';
import { useAppStore } from '~/lib/store';
import type { AppConfig, Credential, McpPreset, McpServerConfig, Skill } from '~/lib/types';
import {
  headlessDeleteCredential,
  headlessDeleteMcpServer,
  headlessDeleteSkill,
  headlessGetCredentials,
  headlessGetLogs,
  headlessGetMcpPresets,
  headlessGetMcpServerStatus,
  headlessGetMcpServers,
  headlessGetMcpTools,
  headlessGetModels,
  headlessGetSkills,
  headlessInstallSkill,
  headlessLogsClear,
  headlessLogsExport,
  headlessLogsIsEnabled,
  headlessLogsSetEnabled,
  headlessSaveConfig,
  headlessSaveCredential,
  headlessSaveMcpServer,
  headlessSetSkillEnabled,
  headlessUpdateCredential,
  headlessValidateSkillPath,
  type HeadlessLogFile,
} from '~/lib/headless-api';
import { supportsToolCalling } from '~/lib/model-capabilities';

export interface SettingsInitialData {
  credentials?: Credential[];
  mcpServers?: McpServerConfig[];
  mcpPresets?: Record<string, McpPreset>;
  skills?: Skill[];
  logsEnabled?: boolean;
  currentModel?: string;
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValueLines(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of value.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [key, ...rest] = trimmed.split('=');
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) continue;
    result[normalizedKey] = rest.join('=').trim();
  }
  return result;
}

function formatKeyValueLines(value?: Record<string, string>): string {
  return Object.entries(value || {})
    .map(([key, item]) => `${key}=${item}`)
    .join('\n');
}

function buildAppConfig(model: string): AppConfig {
  return {
    provider: 'openrouter',
    apiKey: '',
    baseUrl: '',
    model,
    isConfigured: Boolean(model),
  };
}

function emptyConnectorDraft(): McpServerConfig {
  return {
    id: '',
    name: '',
    alias: '',
    type: 'http',
    url: '',
    command: '',
    args: [],
    env: {},
    headers: {},
    enabled: true,
  };
}

export function SettingsPanel() {
  return null;
}

export function Banner({ tone, text }: { tone: 'error' | 'success' | 'info'; text: string }) {
  const style =
    tone === 'error'
      ? 'bg-error/10 text-error'
      : tone === 'success'
        ? 'bg-success/10 text-success'
        : 'bg-blue-500/10 text-blue-700';
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${style}`}>
      {tone === 'error' ? <AlertCircle className="h-4 w-4" /> : null}
      {tone === 'success' ? <CheckCircle className="h-4 w-4" /> : null}
      {tone === 'info' ? <Activity className="h-4 w-4" /> : null}
      <span>{text}</span>
    </div>
  );
}

export function RuntimeSettingsSection({ currentModel }: { currentModel?: string }) {
  const setAppConfig = useAppStore((state) => state.setAppConfig);
  const setIsConfigured = useAppStore((state) => state.setIsConfigured);
  const [model, setModel] = useState(currentModel || '');
  const [models, setModels] = useState<Array<{ id: string; name: string; supportsTools: boolean }>>(
    []
  );
  const [customModel, setCustomModel] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    void headlessGetModels()
      .then((list) => {
        if (!alive) return;
        setModels(list);
        if (!model && list.length > 0) {
          const supported = list.find((item) => item.supportsTools) || list[0];
          setModel(supported.id);
        }
      })
      .catch((nextError) => {
        if (!alive) return;
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [model]);

  const save = async () => {
    const resolvedModel = (useCustomModel ? customModel : model).trim();
    if (!resolvedModel) {
      setError('Model is required.');
      return;
    }
    if (!supportsToolCalling(resolvedModel)) {
      setError('Choose a model that supports tool calling.');
      return;
    }
    setError('');
    await headlessSaveConfig({ model: resolvedModel });
    setAppConfig(buildAppConfig(resolvedModel));
    setIsConfigured(true);
    setSuccess('Runtime settings saved.');
    window.setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <div className="space-y-4">
      {error ? <Banner tone="error" text={error} /> : null}
      {success ? <Banner tone="success" text={success} /> : null}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Model routing</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Runtime model selection is stored server-side and used for new runs.
          </p>
        </div>
        <label className="text-sm">
          Model
          <select
            className="input mt-1"
            value={model}
            onChange={(event) => {
              setModel(event.target.value);
              setUseCustomModel(false);
            }}
            disabled={loading}
          >
            {loading ? <option value="">Loading models…</option> : null}
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.supportsTools ? entry.name : `${entry.name} (no tool support)`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Custom model override
          <input
            className="input mt-1"
            value={useCustomModel ? customModel : ''}
            placeholder="Optional exact model id"
            onChange={(event) => {
              const value = event.target.value;
              setCustomModel(value);
              setUseCustomModel(Boolean(value.trim()));
            }}
          />
        </label>
        <button type="button" className="btn btn-primary text-sm" onClick={() => void save()}>
          <Save className="h-4 w-4" />
          Save runtime defaults
        </button>
      </div>
    </div>
  );
}

export function CredentialsSection({ initialItems }: { initialItems?: Credential[] }) {
  const [items, setItems] = useState<Credential[]>(initialItems || []);
  const [draft, setDraft] = useState<Partial<Credential>>({ type: 'api' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    const credentials = await headlessGetCredentials();
    setItems(credentials);
  };

  useEffect(() => {
    if (!initialItems) {
      void load().catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : String(nextError))
      );
    }
  }, [initialItems]);

  const resetDraft = () => {
    setDraft({ type: 'api' });
    setEditingId(null);
  };

  const save = async () => {
    if (!draft.name?.trim() || !draft.username?.trim()) {
      setError('Credential name and username are required.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type || 'other',
        service: draft.service?.trim() || '',
        username: draft.username.trim(),
        password: draft.password ?? '',
        url: draft.url?.trim() || '',
        notes: draft.notes ?? '',
      };
      if (editingId) {
        await headlessUpdateCredential(editingId, payload);
      } else {
        await headlessSaveCredential(payload);
      }
      await load();
      resetDraft();
      setSuccess(editingId ? 'Credential updated.' : 'Credential created.');
      window.setTimeout(() => setSuccess(''), 2000);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (credentialId: string) => {
    try {
      await headlessDeleteCredential(credentialId);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  return (
    <div className="space-y-4">
      {error ? <Banner tone="error" text={error} /> : null}
      {success ? <Banner tone="success" text={success} /> : null}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">
            {editingId ? 'Edit credential' : 'Add credential'}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Credentials are stored per-user. Use them to back connectors and service-specific auth.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Name
            <input
              className="input mt-1"
              value={draft.name || ''}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="text-sm">
            Type
            <select
              className="input mt-1"
              value={draft.type || 'api'}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  type: event.target.value as Credential['type'],
                }))
              }
            >
              <option value="api">API</option>
              <option value="website">Website</option>
              <option value="email">Email</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            Service
            <input
              className="input mt-1"
              value={draft.service || ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, service: event.target.value }))
              }
              placeholder="GitHub, OpenAlex, internal portal…"
            />
          </label>
          <label className="text-sm">
            URL
            <input
              className="input mt-1"
              value={draft.url || ''}
              onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
            />
          </label>
          <label className="text-sm">
            Username / identity
            <input
              className="input mt-1"
              value={draft.username || ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, username: event.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            Secret
            <input
              type="password"
              autoComplete="new-password"
              className="input mt-1"
              value={draft.password || ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>
        </div>
        <label className="text-sm block">
          Notes
          <textarea
            className="input mt-1 min-h-[90px]"
            value={draft.notes || ''}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => void save()}
            disabled={isSaving}
          >
            {editingId ? 'Update credential' : 'Save credential'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-secondary text-sm" onClick={resetDraft}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-background-secondary px-4 py-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.name}</div>
                <div className="mt-1 text-xs text-text-muted">
                  {item.type} · {item.username}
                  {item.service ? ` · ${item.service}` : ''}
                </div>
                {item.url ? (
                  <a
                    className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                {item.notes ? (
                  <div className="mt-2 text-xs text-text-secondary whitespace-pre-wrap">
                    {item.notes}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => {
                    setEditingId(item.id);
                    setDraft(item);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-error"
                  onClick={() => void remove(item.id)}
                  aria-label={`Delete credential ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-text-muted">
            No credentials saved for this user yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConnectorsSection({
  initialServers,
  initialPresets,
}: {
  initialServers?: McpServerConfig[];
  initialPresets?: Record<string, McpPreset>;
}) {
  const [servers, setServers] = useState<McpServerConfig[]>(initialServers || []);
  const [presets, setPresets] = useState<Record<string, McpPreset>>(initialPresets || {});
  const [statuses, setStatuses] = useState<
    Array<{
      id: string;
      name: string;
      alias?: string;
      enabled: boolean;
      connected: boolean;
      toolCount: number;
      error?: string;
      health?: Record<string, unknown>;
    }>
  >([]);
  const [tools, setTools] = useState<
    Array<{
      serverId: string;
      serverName: string;
      serverAlias?: string;
      name: string;
      description: string;
    }>
  >([]);
  const [draft, setDraft] = useState<McpServerConfig>(emptyConnectorDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [argsText, setArgsText] = useState('');
  const [envText, setEnvText] = useState('');
  const [headersText, setHeadersText] = useState('');

  const statusById = useMemo(() => new Map(statuses.map((entry) => [entry.id, entry])), [statuses]);
  const toolsByServerId = useMemo(() => {
    const next = new Map<string, typeof tools>();
    for (const tool of tools) {
      const existing = next.get(tool.serverId) || [];
      existing.push(tool);
      next.set(tool.serverId, existing);
    }
    return next;
  }, [tools]);

  const load = async () => {
    const [nextServers, nextStatuses, nextTools, nextPresets] = await Promise.all([
      headlessGetMcpServers(),
      headlessGetMcpServerStatus(),
      headlessGetMcpTools(),
      headlessGetMcpPresets(),
    ]);
    setServers(nextServers);
    setStatuses(nextStatuses);
    setTools(nextTools);
    setPresets(nextPresets as Record<string, McpPreset>);
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load().catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : String(nextError))
      );
    }, 0);
    const pollId = window.setInterval(() => {
      void Promise.all([headlessGetMcpServerStatus(), headlessGetMcpTools()])
        .then(([nextStatuses, nextTools]) => {
          setStatuses(nextStatuses);
          setTools(nextTools);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      window.clearTimeout(loadTimer);
      window.clearInterval(pollId);
    };
  }, []);

  const resetDraft = () => {
    setDraft(emptyConnectorDraft());
    setEditingId(null);
    setArgsText('');
    setEnvText('');
    setHeadersText('');
  };

  const loadDraft = (server: McpServerConfig) => {
    setDraft({
      ...server,
      args: server.args || [],
      env: server.env || {},
      headers: server.headers || {},
    });
    setEditingId(server.id);
    setArgsText((server.args || []).join('\n'));
    setEnvText(formatKeyValueLines(server.env));
    setHeadersText(formatKeyValueLines(server.headers));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Connector name is required.');
      return;
    }
    if (draft.type === 'http' || draft.type === 'sse') {
      if (!String(draft.url || '').trim()) {
        setError('URL is required for HTTP and SSE connectors.');
        return;
      }
    }
    if (draft.type === 'stdio' && !String(draft.command || '').trim()) {
      setError('Command is required for stdio connectors.');
      return;
    }
    setError('');
    const payload: McpServerConfig = {
      ...draft,
      id: editingId || draft.id || '',
      alias: draft.alias?.trim() || undefined,
      url: draft.type === 'stdio' ? undefined : draft.url?.trim() || undefined,
      command: draft.type === 'stdio' ? draft.command?.trim() || undefined : undefined,
      args: draft.type === 'stdio' ? parseLines(argsText) : undefined,
      env: parseKeyValueLines(envText),
      headers: draft.type === 'stdio' ? undefined : parseKeyValueLines(headersText),
      enabled: draft.enabled !== false,
    };
    await headlessSaveMcpServer(payload);
    await load();
    resetDraft();
    setSuccess(editingId ? 'Connector updated.' : 'Connector created.');
    window.setTimeout(() => setSuccess(''), 2000);
  };

  const addPreset = async (key: string) => {
    const preset = presets[key];
    if (!preset) return;
    await headlessSaveMcpServer({
      id: '',
      name: preset.name,
      alias: preset.alias,
      type: preset.type,
      command: preset.command,
      args: preset.args,
      env: preset.env,
      url: preset.url,
      headers: preset.headers,
      enabled: true,
    });
    await load();
  };

  const toggleEnabled = async (server: McpServerConfig) => {
    await headlessSaveMcpServer({ ...server, enabled: !server.enabled });
    await load();
  };

  const remove = async (serverId: string) => {
    await headlessDeleteMcpServer(serverId);
    await load();
    if (editingId === serverId) {
      resetDraft();
    }
  };

  return (
    <div className="space-y-4">
      {error ? <Banner tone="error" text={error} /> : null}
      {success ? <Banner tone="success" text={success} /> : null}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {editingId ? 'Edit connector' : 'Add connector'}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Connectors are user-scoped. Project defaults determine which of these are active for a
              given workspace.
            </p>
          </div>
          {editingId ? (
            <button type="button" className="btn btn-secondary text-sm" onClick={resetDraft}>
              New connector
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => void addPreset(key)}
            >
              Add preset: {preset.name}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Name
            <input
              className="input mt-1"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="text-sm">
            Alias
            <input
              className="input mt-1"
              value={draft.alias || ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, alias: event.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            Type
            <select
              className="input mt-1"
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  type: event.target.value as McpServerConfig['type'],
                }))
              }
            >
              <option value="http">HTTP</option>
              <option value="sse">SSE</option>
              <option value="stdio">STDIO</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft((current) => ({ ...current, enabled: event.target.checked }))
              }
            />
            Enabled
          </label>
        </div>
        {draft.type === 'stdio' ? (
          <div className="grid gap-3">
            <label className="text-sm">
              Command
              <input
                className="input mt-1"
                value={draft.command || ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, command: event.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              Arguments
              <textarea
                className="input mt-1 min-h-[100px]"
                value={argsText}
                onChange={(event) => setArgsText(event.target.value)}
                placeholder="One argument per line"
              />
            </label>
          </div>
        ) : (
          <label className="text-sm block">
            URL
            <input
              className="input mt-1"
              value={draft.url || ''}
              onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
            />
          </label>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Environment
            <textarea
              className="input mt-1 min-h-[100px]"
              value={envText}
              onChange={(event) => setEnvText(event.target.value)}
              placeholder="KEY=value"
            />
          </label>
          <label className="text-sm">
            Headers
            <textarea
              className="input mt-1 min-h-[100px]"
              value={headersText}
              onChange={(event) => setHeadersText(event.target.value)}
              placeholder="Header-Name=value"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary text-sm" onClick={() => void save()}>
            {editingId ? 'Update connector' : 'Save connector'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-secondary text-sm" onClick={resetDraft}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {servers.map((server) => {
          const status = statusById.get(server.id);
          const serverTools = toolsByServerId.get(server.id) || [];
          return (
            <div
              key={server.id}
              className="rounded-xl border border-border bg-background-secondary px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{server.name}</div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                      {server.type}
                    </span>
                    {status?.connected ? (
                      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success">
                        connected
                      </span>
                    ) : server.enabled ? (
                      <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                        unavailable
                      </span>
                    ) : (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                        disabled
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {server.alias ? `${server.alias} · ` : ''}
                    {status?.toolCount || serverTools.length} discovered tools
                  </div>
                  {server.url ? (
                    <div className="mt-1 text-xs text-text-secondary break-all">{server.url}</div>
                  ) : null}
                  {server.command ? (
                    <div className="mt-1 text-xs text-text-secondary break-all">
                      {server.command} {(server.args || []).join(' ')}
                    </div>
                  ) : null}
                  {status?.error ? (
                    <div className="mt-2 text-xs text-error">{status.error}</div>
                  ) : null}
                  {serverTools.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {serverTools.slice(0, 8).map((tool) => (
                        <span
                          key={`${server.id}-${tool.name}`}
                          className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary"
                        >
                          {tool.name}
                        </span>
                      ))}
                      {serverTools.length > 8 ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                          +{serverTools.length - 8} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => loadDraft(server)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => void toggleEnabled(server)}
                  >
                    {server.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-error"
                    onClick={() => void remove(server.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {servers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-text-muted">
            No connectors configured for this user yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SkillsSection({
  initialSkills,
  pinnedSkillIds = [],
  onPinnedSkillIdsChange,
}: {
  initialSkills?: Skill[];
  pinnedSkillIds?: string[];
  onPinnedSkillIdsChange?: (skillIds: string[]) => void;
}) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills || []);
  const [error, setError] = useState('');
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const pinnedSet = useMemo(() => new Set(pinnedSkillIds), [pinnedSkillIds]);

  const load = async () => {
    const nextSkills = await headlessGetSkills();
    setSkills(nextSkills);
  };

  useEffect(() => {
    if (!initialSkills) {
      const loadTimer = window.setTimeout(() => {
        void load().catch((nextError) =>
          setError(nextError instanceof Error ? nextError.message : String(nextError))
        );
      }, 0);
      return () => window.clearTimeout(loadTimer);
    }
  }, [initialSkills]);

  const install = async (folderPath?: string) => {
    setShowInstallDialog(false);
    if (!folderPath?.trim()) return;
    const validation = await headlessValidateSkillPath(folderPath.trim());
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }
    await headlessInstallSkill(folderPath.trim());
    await load();
  };

  const toggleEnabled = async (skill: Skill) => {
    await headlessSetSkillEnabled(skill.id, !skill.enabled);
    await load();
  };

  const remove = async (skillId: string) => {
    await headlessDeleteSkill(skillId);
    onPinnedSkillIdsChange?.(pinnedSkillIds.filter((item) => item !== skillId));
    await load();
  };

  const togglePinned = (skillId: string) => {
    const next = pinnedSet.has(skillId)
      ? pinnedSkillIds.filter((item) => item !== skillId)
      : [...pinnedSkillIds, skillId];
    onPinnedSkillIdsChange?.(next);
  };

  return (
    <div className="space-y-4">
      {error ? <Banner tone="error" text={error} /> : null}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Skill registry</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Enable skills at the user level, then pin a subset to this project.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setShowInstallDialog(true)}
          >
            Install skill
          </button>
        </div>
        {showInstallDialog ? (
          <AlertDialog
            open={showInstallDialog}
            title="Install skill"
            inputLabel="Skill folder path (must contain SKILL.md)"
            confirmLabel="Install"
            onConfirm={(value) => void install(value)}
            onCancel={() => setShowInstallDialog(false)}
          />
        ) : null}
      </div>

      <div className="space-y-3">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="rounded-xl border border-border bg-background-secondary px-4 py-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{skill.name}</div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                    {skill.source?.kind || skill.type}
                  </span>
                  {skill.enabled ? (
                    <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success">
                      enabled
                    </span>
                  ) : null}
                  {pinnedSet.has(skill.id) ? (
                    <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                      pinned to project
                    </span>
                  ) : null}
                </div>
                {skill.description ? (
                  <div className="mt-1 text-sm text-text-secondary">{skill.description}</div>
                ) : null}
                {Array.isArray(skill.tools) && skill.tools.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {skill.tools.slice(0, 8).map((tool) => (
                      <span
                        key={`${skill.id}-${tool}`}
                        className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={pinnedSet.has(skill.id)}
                    onChange={() => togglePinned(skill.id)}
                    disabled={!skill.enabled}
                  />
                  Pin
                </label>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => void toggleEnabled(skill)}
                >
                  {skill.enabled ? 'Disable' : 'Enable'}
                </button>
                {skill.source?.kind === 'custom' ? (
                  <button
                    type="button"
                    className="btn btn-ghost text-error"
                    onClick={() => void remove(skill.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {skills.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-text-muted">
            No skills available.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DiagnosticsSection({
  initialEnabled,
}: {
  initialEnabled?: boolean;
}) {
  const [files, setFiles] = useState<HeadlessLogFile[]>([]);
  const [directory, setDirectory] = useState('');
  const [enabled, setEnabled] = useState(initialEnabled ?? true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const [logs, logsEnabled] = await Promise.all([headlessGetLogs(), headlessLogsIsEnabled()]);
    setFiles(logs.files);
    setDirectory(logs.directory);
    setEnabled(logsEnabled);
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load().catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : String(nextError))
      );
    }, 0);
    const pollId = window.setInterval(() => {
      void load().catch(() => {});
    }, 3000);
    return () => {
      window.clearTimeout(loadTimer);
      window.clearInterval(pollId);
    };
  }, []);

  const toggleLogs = async () => {
    const next = !enabled;
    setEnabled(next);
    await headlessLogsSetEnabled(next);
  };

  const exportLogs = async () => {
    const result = await headlessLogsExport();
    setSuccess(`Exported to ${result.path}`);
  };

  const clear = async () => {
    await headlessLogsClear();
    setSuccess('Logs cleared.');
    await load();
  };

  return (
    <div className="space-y-4">
      {error ? <Banner tone="error" text={error} /> : null}
      {success ? <Banner tone="success" text={success} /> : null}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary text-sm" onClick={() => void toggleLogs()}>
            {enabled ? 'Disable logs' : 'Enable logs'}
          </button>
          <button type="button" className="btn btn-secondary text-sm" onClick={() => void exportLogs()}>
            Export logs
          </button>
          <button type="button" className="btn btn-ghost text-error" onClick={() => void clear()}>
            Clear logs
          </button>
        </div>
        {directory ? (
          <div className="text-xs text-text-muted">
            Log directory: <span className="font-mono">{directory}</span>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.path}
            className="flex items-center justify-between rounded-xl border border-border bg-background-secondary px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate font-mono text-sm">{file.name}</div>
              <div className="text-xs text-text-muted">{file.mtime}</div>
            </div>
            <div className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        ))}
        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-text-muted">
            No diagnostic logs available yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
