import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import {
  AlertCircle,
  CheckCircle,
  Database,
  Key,
  Package,
  Plug,
  Save,
  Settings,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useAppStore } from '~/lib/store';
import type { AppConfig, Skill } from '~/lib/types';
import {
  getBrowserConfig,
  saveBrowserConfig,
} from '~/lib/browser-config';
import {
  headlessGetCredentials,
  headlessGetLogs,
  headlessGetMcpPresets,
  headlessGetMcpServerStatus,
  headlessGetMcpServers,
  headlessGetMcpTools,
  headlessGetModels,
  headlessGetSkills,
  headlessLogsIsEnabled,
  headlessValidateSkillPath,
} from '~/lib/headless-api';

interface SettingsInitialData {
  credentials?: any[];
  mcpServers?: any[];
  mcpPresets?: Record<string, any>;
  skills?: any[];
  logsEnabled?: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'api' | 'sandbox' | 'credentials' | 'connectors' | 'skills' | 'logs';
  initialData?: SettingsInitialData;
  mode?: 'modal' | 'page';
}

type TabId = 'api' | 'sandbox' | 'credentials' | 'connectors' | 'skills' | 'logs';

type Credential = {
  id: string;
  name: string;
  type: 'email' | 'website' | 'api' | 'other';
  service?: string;
  username: string;
  password?: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type MCPServerConfig = {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
};

const TABS: Array<{ id: TabId; label: string; description: string; icon: any }> = [
  { id: 'api', label: 'API', description: 'Provider, model, and key setup', icon: Settings },
  { id: 'sandbox', label: 'Sandbox', description: 'Runtime isolation guidance', icon: Shield },
  { id: 'credentials', label: 'Credentials', description: 'Project/service secrets', icon: Key },
  { id: 'connectors', label: 'MCP', description: 'Connector servers and tools', icon: Plug },
  { id: 'skills', label: 'Skills', description: 'Install and enable capabilities', icon: Package },
  { id: 'logs', label: 'Logs', description: 'Service diagnostics and export', icon: Database },
];

export function SettingsPanel({ isOpen, onClose, initialTab = 'api', initialData, mode = 'modal' }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className={`bg-surface rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[88vh] overflow-hidden border border-border flex ${mode === 'page' ? 'mx-auto my-4' : ''}`}>
      <div className="w-72 border-r border-border p-3 space-y-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${activeTab === tab.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-hover'}`}
          >
            <tab.icon className="w-4 h-4" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{tab.label}</p>
              <p className="text-xs text-text-muted truncate">{tab.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{TABS.find((tab) => tab.id === activeTab)?.label}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-surface-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeTab === 'api' && <APISettingsTab />}
        {activeTab === 'sandbox' && <SandboxTab />}
        {activeTab === 'credentials' && <CredentialsTab initialItems={initialData?.credentials} />}
        {activeTab === 'connectors' && <ConnectorsTab initialServers={initialData?.mcpServers} initialPresets={initialData?.mcpPresets} />}
        {activeTab === 'skills' && <SkillsTab initialSkills={initialData?.skills} />}
        {activeTab === 'logs' && <LogsTab initialEnabled={initialData?.logsEnabled} />}
      </div>
    </div>
  );

  if (mode === 'page') {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      {content}
    </div>
  );
}

function APISettingsTab() {
  const setAppConfig = useAppStore((state) => state.setAppConfig);
  const setIsConfigured = useAppStore((state) => state.setIsConfigured);
  const fetcher = useFetcher();
  const [config, setConfig] = useState<AppConfig>(() => getBrowserConfig());
  const [model, setModel] = useState(config.model || '');
  const [customModel, setCustomModel] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    headlessGetModels()
      .then((list) => {
        setModels(list);
        if (list.length > 0 && !model) {
          setModel(list[0].id);
        }
      })
      .catch((e) => setError(`Failed to load models: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = () => {
    const resolvedModel = (useCustomModel ? customModel : model).trim();
    if (!resolvedModel) {
      setError('Model is required.');
      return;
    }
    const next: AppConfig = {
      ...config,
      model: resolvedModel,
    };
    setError('');
    fetcher.submit({ model: resolvedModel } as Record<string, string>, {
      method: "POST",
      action: "/api/config",
      encType: "application/json",
    });
    saveBrowserConfig(next);
    setConfig(next);
    setAppConfig(next);
    setIsConfigured(true);
    setSuccess('Saved.');
    setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <div className="space-y-3">
      {error && <Banner tone="error" text={error} />}
      {success && <Banner tone="success" text={success} />}
      <p className="text-sm text-text-secondary">
        Models are served through the LiteLLM gateway. API credentials are configured via server environment variables.
      </p>
      <label className="text-sm">Model
        <select
          className="input mt-1"
          value={model}
          onChange={(e) => { setModel(e.target.value); setUseCustomModel(false); }}
          disabled={loading}
        >
          {loading && <option>Loading models...</option>}
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Custom Model (optional)
        <input
          className="input mt-1"
          value={useCustomModel ? customModel : ''}
          placeholder="Enter custom model ID"
          onChange={(e) => {
            const next = e.target.value;
            setCustomModel(next);
            setUseCustomModel(Boolean(next.trim()));
          }}
        />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => void saveConfig()}>
          <Save className="w-4 h-4" />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}

function SandboxTab() {
  return (
    <div className="space-y-3">
      <Banner tone="info" text="Sandbox controls are removed in headless mode. Isolation is handled by your container/VM runtime." />
      <p className="text-sm text-text-secondary">Configure host-level security (container user, seccomp/apparmor, IAM, network policy) outside this app.</p>
    </div>
  );
}

function CredentialsTab({ initialItems }: { initialItems?: any[] }) {
  const [items, setItems] = useState<Credential[]>(initialItems as Credential[] || []);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Partial<Credential>>({ type: 'api' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const fetcher = useFetcher();

  const load = async () => {
    try {
      setItems(await headlessGetCredentials());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { if (!initialItems) void load(); }, []);

  // Re-fetch after fetcher completes a mutation
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      void load();
    }
  }, [fetcher.state, fetcher.data]);

  const save = () => {
    if (!draft.name?.trim() || !draft.username?.trim()) return;
    if (editingId) {
      fetcher.submit(draft as unknown as Record<string, string>, {
        method: "PATCH",
        action: `/api/credentials/${editingId}`,
        encType: "application/json",
      });
    } else {
      fetcher.submit({
        name: draft.name.trim(),
        type: draft.type || 'other',
        username: draft.username.trim(),
        password: draft.password ?? '',
        service: draft.service ?? '',
        url: draft.url ?? '',
        notes: draft.notes ?? '',
      } as Record<string, string>, {
        method: "POST",
        action: "/api/credentials",
        encType: "application/json",
      });
    }
    setDraft({ type: 'api' });
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    fetcher.submit({}, {
      method: "DELETE",
      action: `/api/credentials/${id}`,
      encType: "application/json",
    });
  };

  return (
    <div className="space-y-3">
      {error && <Banner tone="error" text={error} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="input" placeholder="Name" value={draft.name || ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <input className="input" placeholder="Username" value={draft.username || ''} onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))} />
        <input className="input" placeholder="Secret/Password" type="password" value={draft.password || ''} onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))} />
      </div>
      <button className="btn btn-primary" onClick={save}>{editingId ? 'Update' : 'Save'} Credential</button>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="p-3 rounded border border-border bg-surface-muted flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{item.name}</div>
              <div className="text-xs text-text-muted">{item.username}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => { setEditingId(item.id); setDraft(item); }}>Edit</button>
              <button className="btn btn-ghost text-error" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectorsTab({ initialServers, initialPresets }: { initialServers?: any[]; initialPresets?: Record<string, any> }) {
  const [servers, setServers] = useState<MCPServerConfig[]>(initialServers as MCPServerConfig[] || []);
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; connected: boolean; toolCount: number }>>([]);
  const [tools, setTools] = useState<Array<{ serverId: string; name: string; description: string }>>([]);
  const [presets, setPresets] = useState<Record<string, any>>(initialPresets || {});
  const [error, setError] = useState('');
  const fetcher = useFetcher();

  const loadAll = async () => {
    try {
      const [s, st, t, p] = await Promise.all([
        headlessGetMcpServers(),
        headlessGetMcpServerStatus(),
        headlessGetMcpTools(),
        headlessGetMcpPresets(),
      ]);
      setServers(s as any);
      setStatuses(st);
      setTools(t);
      setPresets(p as any);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (!initialServers) void loadAll();
    const timer = setInterval(() => void loadAll(), 4000);
    return () => clearInterval(timer);
  }, []);

  const addPreset = (key: string) => {
    const preset = presets[key];
    if (!preset) return;
    fetcher.submit({
      id: `mcp-${key}-${Date.now()}`,
      name: preset.name || key,
      type: preset.type || 'stdio',
      command: preset.command,
      args: Array.isArray(preset.args) ? preset.args : [],
      env: preset.env || {},
      url: preset.url,
      headers: preset.headers || {},
      enabled: true,
    }, {
      method: "POST",
      action: "/api/mcp/servers",
      encType: "application/json",
    });
  };

  const toggleServer = (server: MCPServerConfig) => {
    fetcher.submit({ ...server, enabled: !server.enabled }, {
      method: "POST",
      action: "/api/mcp/servers",
      encType: "application/json",
    });
  };

  const deleteServer = (id: string) => {
    fetcher.submit({}, {
      method: "DELETE",
      action: `/api/mcp/servers/${id}`,
      encType: "application/json",
    });
  };

  return (
    <div className="space-y-3">
      {error && <Banner tone="error" text={error} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {Object.keys(presets).map((key) => (
          <button key={key} className="btn btn-secondary" onClick={() => addPreset(key)}>Add Preset: {presets[key].name || key}</button>
        ))}
      </div>
      <div className="space-y-2">
        {servers.map((server) => {
          const status = statuses.find((s) => s.id === server.id);
          const count = tools.filter((t) => t.serverId === server.id).length || status?.toolCount || 0;
          return (
            <div key={server.id} className="p-3 rounded border border-border bg-surface-muted flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{server.name}</div>
                <div className="text-xs text-text-muted">{server.type} • {status?.connected ? 'connected' : 'disabled'} • {count} tools</div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => toggleServer(server)}>{server.enabled ? 'Disable' : 'Enable'}</button>
                <button className="btn btn-ghost text-error" onClick={() => deleteServer(server.id)}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillsTab({ initialSkills }: { initialSkills?: any[] }) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills as Skill[] || []);
  const [error, setError] = useState('');
  const fetcher = useFetcher();

  const load = async () => {
    try {
      setSkills(await headlessGetSkills() as any);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { if (!initialSkills) void load(); }, []);

  // Re-fetch after fetcher completes a mutation
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      void load();
    }
  }, [fetcher.state, fetcher.data]);

  const install = async () => {
    const folderPath = window.prompt('Skill folder path (must contain SKILL.md):');
    if (!folderPath?.trim()) return;
    const validation = await headlessValidateSkillPath(folderPath.trim());
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }
    fetcher.submit({ folderPath: folderPath.trim() }, {
      method: "POST",
      action: "/api/skills/install",
      encType: "application/json",
    });
  };

  const toggleEnabled = (skill: Skill) => {
    fetcher.submit({ enabled: !skill.enabled }, {
      method: "POST",
      action: `/api/skills/${skill.id}/enabled`,
      encType: "application/json",
    });
  };

  const deleteSkill = (id: string) => {
    fetcher.submit({}, {
      method: "DELETE",
      action: `/api/skills/${id}`,
      encType: "application/json",
    });
  };

  return (
    <div className="space-y-3">
      {error && <Banner tone="error" text={error} />}
      <button className="btn btn-primary" onClick={() => void install()}>Install Skill From Path</button>
      <div className="space-y-2">
        {skills.map((skill) => (
          <div key={skill.id} className="p-3 rounded border border-border bg-surface-muted flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{skill.name}</div>
              <div className="text-xs text-text-muted">{skill.type}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => toggleEnabled(skill)}>{skill.enabled ? 'Disable' : 'Enable'}</button>
              {skill.type !== 'builtin' && <button className="btn btn-ghost text-error" onClick={() => deleteSkill(skill.id)}><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab({ initialEnabled }: { initialEnabled?: boolean }) {
  const [files, setFiles] = useState<Array<{ name: string; path: string; size: number; mtime: string | Date }>>([]);
  const [dir, setDir] = useState('');
  const [enabled, setEnabled] = useState(initialEnabled ?? true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fetcher = useFetcher();

  const load = async () => {
    try {
      const [logs, isEnabled] = await Promise.all([headlessGetLogs(), headlessLogsIsEnabled()]);
      setFiles(logs.files);
      setDir(logs.directory);
      setEnabled(isEnabled);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, []);

  // Pick up export/clear results from fetcher
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const data = fetcher.data as any;
      if (data?.path) {
        setSuccess(`Exported: ${data.path}`);
      } else if (data?.deletedCount !== undefined) {
        setSuccess('Logs cleared.');
        void load();
      }
    }
  }, [fetcher.state, fetcher.data]);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    fetcher.submit({ enabled: next }, {
      method: "POST",
      action: "/api/logs/enabled",
      encType: "application/json",
    });
  };

  const exportLogs = () => {
    fetcher.submit({}, {
      method: "POST",
      action: "/api/logs/export",
      encType: "application/json",
    });
  };

  const clearLogs = () => {
    fetcher.submit({}, {
      method: "POST",
      action: "/api/logs/clear",
      encType: "application/json",
    });
  };

  return (
    <div className="space-y-3">
      {error && <Banner tone="error" text={error} />}
      {success && <Banner tone="success" text={success} />}
      <div className="flex gap-2">
        <button className="btn btn-secondary" onClick={toggleEnabled}>{enabled ? 'Disable Dev Logs' : 'Enable Dev Logs'}</button>
        <button className="btn btn-secondary" onClick={exportLogs}>Export</button>
        <button className="btn btn-ghost text-error" onClick={clearLogs}>Clear</button>
      </div>
      {dir && <div className="text-xs text-text-muted">Directory: <span className="font-mono">{dir}</span></div>}
      <div className="space-y-1 max-h-[380px] overflow-y-auto">
        {files.map((file) => (
          <div key={file.path} className="p-2 rounded border border-border bg-surface-muted text-sm flex justify-between">
            <span className="font-mono truncate max-w-[60%]">{file.name}</span>
            <span className="text-text-muted text-xs">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Banner({ tone, text }: { tone: 'error' | 'success' | 'info'; text: string }) {
  const style = tone === 'error'
    ? 'bg-error/10 text-error'
    : tone === 'success'
      ? 'bg-success/10 text-success'
      : 'bg-blue-500/10 text-blue-600';
  return (
    <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${style}`}>
      {tone === 'error' && <AlertCircle className="w-4 h-4" />}
      {tone === 'success' && <CheckCircle className="w-4 h-4" />}
      {tone === 'info' && <Shield className="w-4 h-4" />}
      <span>{text}</span>
    </div>
  );
}
