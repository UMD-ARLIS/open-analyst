import { useMemo, useState } from 'react';
import { useFetcher, useMatches, useNavigate } from 'react-router';
import { useAppStore } from '~/lib/store';
import { useChatStream } from '~/hooks/useChatStream';
import { ArrowRight, FolderOpen, Plus, ClipboardList } from 'lucide-react';
import { ProjectWorkspace } from './ProjectWorkspace';

export function WelcomeView() {
  const {
    projects,
    activeProjectId,
    workingDir,
    setWorkingDir,
  } = useAppStore();
  const { sendMessage } = useChatStream();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const matches = useMatches();

  const [newProjectName, setNewProjectName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  // Read tasks from the project route loader data
  const projectMatch = matches.find((m) => m.id && m.pathname.includes('/projects/'));
  const tasks: Array<{ id: string; title: string; status: string; updatedAt: string | Date }> =
    (projectMatch?.data as any)?.tasks || [];

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

  const handleStartTask = async () => {
    if (!activeProjectId) {
      setError('Create or select a project first.');
      return;
    }
    const text = prompt.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const { taskId } = await sendMessage({
        prompt: text,
        projectId: activeProjectId,
      });
      setPrompt('');
      if (taskId) {
        navigate(`/projects/${activeProjectId}/tasks/${taskId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectFolder = async () => {
    const path = window.prompt('Enter working directory path (local path or s3:// URI):');
    if (!path?.trim()) return;
    try {
      const res = await fetch('/api/workdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkingDir(data.path);
      }
    } catch {
      // ignore
    }
  };

  if (projects.length === 0 || !activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="card w-full max-w-xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Create a Project First</h1>
          <p className="text-sm text-text-secondary">
            This workspace is project-oriented. Create a project to manage tasks, collections, sources, tools, and skills.
          </p>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Project name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreateProject();
                }
              }}
            />
            <button className="btn btn-primary" onClick={() => void handleCreateProject()}>
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </button>
          </div>
          {error && <div className="text-sm text-error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{activeProject?.name || 'Project'}</h1>
            <p className="text-sm text-text-secondary">Project dashboard: start tasks, inspect history, and manage project resources.</p>
          </div>
          <button className="btn btn-secondary" onClick={handleSelectFolder}>
            <FolderOpen className="w-4 h-4" />
            <span>{workingDir ? workingDir.split(/[/\\]/).pop() : 'Set Workdir'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-2">
            <textarea
              className="input min-h-[96px]"
              placeholder="Start a new task for this project"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleStartTask();
                }
              }}
            />
            <button className="btn btn-primary" onClick={() => void handleStartTask()} disabled={!prompt.trim() || isSubmitting}>
              <span>{isSubmitting ? 'Starting...' : 'Start New Task'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-surface-muted border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold">Task History</h2>
            </div>
            <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <p className="text-xs text-text-muted">No tasks yet.</p>
              ) : (
                tasks.map((task) => (
                  <button
                    key={task.id}
                    className="w-full text-left px-2 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover"
                    onClick={() => navigate(`/projects/${activeProjectId}/tasks/${task.id}`)}
                  >
                    <div className="text-sm truncate">{task.title}</div>
                    <div className="text-xs text-text-muted">{task.status}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-error">{error}</div>}
      </div>

      <ProjectWorkspace fixedProjectId={activeProjectId} showProjectColumn={false} />
    </div>
  );
}
