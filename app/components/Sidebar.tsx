import { useEffect, useState } from 'react';
import { useFetcher, useLocation, useMatches, useNavigate } from 'react-router';
import { useAppStore } from '~/lib/store';
import { ChevronLeft, ChevronRight, FolderKanban, Moon, Plus, Settings, Sun, Trash2, Pencil } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';

export function Sidebar() {
  const {
    settings,
    sidebarCollapsed,
    toggleSidebar,
    updateSettings,
    projects,
    activeProjectId,
    upsertProject,
    removeProject,
    isConfigured,
  } = useAppStore();
  const fetcher = useFetcher();
  const taskFetcher = useFetcher();
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const [showSettings, setShowSettings] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Extract tasks from project route loader data
  const projectMatch = matches.find((m) => m.id && m.pathname.includes('/projects/'));
  const tasks: Array<{ id: string; title: string; status: string; updatedAt: string | Date }> =
    (projectMatch?.data as any)?.tasks || [];

  // Determine active taskId from URL
  const taskMatch = matches.find((m) => (m.params as any)?.taskId);
  const activeTaskId = (taskMatch?.params as any)?.taskId || null;

  // Navigate to new project after creation
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const data = fetcher.data as any;
      if (data?.project?.id) {
        navigate(`/projects/${data.project.id}`);
      }
    }
  }, [fetcher.state, fetcher.data, navigate]);

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    setError(null);
    setNewProjectName('');
    fetcher.submit(
      { name },
      { method: "POST", action: "/api/projects", encType: "application/json" }
    );
  };

  const handleSelectProject = (projectId: string) => {
    setError(null);
    navigate(`/projects/${projectId}`);
  };

  const handleRenameProject = (projectId: string, currentName: string) => {
    const nextName = window.prompt('Rename project', currentName);
    if (!nextName || !nextName.trim() || nextName.trim() === currentName) return;
    setError(null);
    upsertProject({ id: projectId, name: nextName.trim() });
    fetcher.submit(
      { name: nextName.trim() },
      { method: "PATCH", action: `/api/projects/${projectId}`, encType: "application/json" }
    );
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    const confirmed = window.confirm(`Delete project "${projectName}"?`);
    if (!confirmed) return;
    setError(null);
    removeProject(projectId);
    fetcher.submit(
      {},
      { method: "DELETE", action: `/api/projects/${projectId}`, encType: "application/json" }
    );
    if (projectId === activeProjectId) {
      navigate('/');
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (!activeProjectId) return;
    taskFetcher.submit(
      {},
      {
        method: "DELETE",
        action: `/api/projects/${activeProjectId}/tasks/${taskId}`,
      }
    );
    // If we're viewing the deleted task, navigate to project root
    if (activeTaskId === taskId) {
      navigate(`/projects/${activeProjectId}`);
    }
  };

  return (
    <div className={`bg-surface border-r border-border flex flex-col overflow-hidden transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-80'}`}>
      <div className={`border-b border-border ${sidebarCollapsed ? 'p-2' : 'px-3 py-3'} flex items-center gap-2`}>
        {sidebarCollapsed ? (
          <>
            <button onClick={toggleSidebar} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary">
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
              <FolderKanban className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold truncate">Projects</h1>
              <p className="text-xs text-text-muted">Project-first workspace</p>
            </div>
            <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary">
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={toggleSidebar} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {!sidebarCollapsed && (
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex gap-2">
            <input
              className="input text-sm py-2"
              placeholder="Create project"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleCreateProject();
                }
              }}
            />
            <button className="btn btn-secondary px-3" onClick={handleCreateProject}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {error && <div className="text-xs text-error">{error}</div>}
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-2 py-2' : 'p-3'} space-y-4`}>
        {!sidebarCollapsed && (
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-text-muted px-1">Projects</div>
            {projects.length === 0 ? (
              <div className="text-sm text-text-muted px-1 py-2">Create your first project to begin.</div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className={`group border rounded-lg px-2 py-2 ${project.id === activeProjectId ? 'border-accent/40 bg-accent-muted' : 'border-border bg-surface-muted'}`}
                >
                  <button className="w-full text-left" onClick={() => handleSelectProject(project.id)}>
                    <div className="text-sm font-medium truncate">{project.name}</div>
                    <div className="text-xs text-text-muted truncate">{project.description || 'No description'}</div>
                  </button>
                  <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-6 h-6 rounded hover:bg-surface-hover text-text-muted" onClick={() => handleRenameProject(project.id, project.name)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button className="w-6 h-6 rounded hover:bg-surface-hover text-error" onClick={() => handleDeleteProject(project.id, project.name)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!sidebarCollapsed && activeProjectId && (
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-text-muted px-1">Tasks</div>
            {tasks.length === 0 ? (
              <div className="text-sm text-text-muted px-1 py-2">No tasks yet in this project.</div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`group flex items-center gap-2 px-2 py-2 rounded-lg border ${activeTaskId === task.id ? 'border-accent/40 bg-accent-muted' : 'border-border bg-surface-muted'}`}
                >
                  <button className="flex-1 text-left min-w-0" onClick={() => navigate(`/projects/${activeProjectId}/tasks/${task.id}`)}>
                    <div className="text-sm truncate">{task.title}</div>
                    <div className="text-xs text-text-muted">{task.status}</div>
                  </button>
                  <button className="w-6 h-6 rounded hover:bg-surface-hover text-error opacity-0 group-hover:opacity-100" onClick={() => handleDeleteTask(task.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={() => {
            if (location.pathname === '/settings') {
              navigate(-1);
            } else {
              setShowSettings(true);
            }
          }}
          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-xl hover:bg-surface-hover transition-colors group`}
        >
          {sidebarCollapsed ? (
            <Settings className="w-4 h-4 text-text-muted" />
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">U</div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">User</span>
                  <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-success' : 'bg-amber-500'}`} />
                </div>
                <p className="text-xs text-text-muted">{isConfigured ? 'API configured' : 'API not configured'}</p>
              </div>
              <Settings className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
            </>
          )}
        </button>
      </div>

      {showSettings && <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
