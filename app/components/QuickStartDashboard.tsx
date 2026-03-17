import { useState } from "react";
import {
  useFetcher,
  useMatches,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useAppStore } from "~/lib/store";
import { ArrowRight, FolderOpen, FlaskConical, BookOpen, ScrollText, Layers3, Package, PenSquare } from "lucide-react";
import { AlertDialog } from "./AlertDialog";
import { formatRelativeTime } from "~/lib/format";
import { headlessCreateRun } from "~/lib/headless-api";

interface RunsLoaderData {
  runs?: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string | Date;
  }>;
}

export function QuickStartDashboard() {
  const navigate = useNavigate();
  const params = useParams();
  const matches = useMatches();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();
  const { workingDir, setWorkingDir } =
    useAppStore();

  const projectId = params.projectId!;

  // Get runs from loader data
  const projectMatch = matches.find((m) => {
    const data = m.data as RunsLoaderData | undefined;
    return Array.isArray(data?.runs);
  });
  const runs = ((projectMatch?.data as RunsLoaderData | undefined)?.runs ?? []);

  const [prompt, setPrompt] = useState("");
  const [showWorkdirDialog, setShowWorkdirDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deepResearch = searchParams.get("deepResearch") === "true";

  const handleStartTask = async () => {
    const text = prompt.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { run } = await headlessCreateRun(projectId, {
        prompt: text,
        mode: deepResearch ? "deep_research" : "chat",
      });
      navigate(`/projects/${projectId}/runs/${run.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDeepResearch = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (deepResearch) next.delete("deepResearch");
        else next.set("deepResearch", "true");
        return next;
      },
      { replace: true }
    );
  };

  const confirmWorkdir = (path?: string) => {
    if (!path?.trim()) {
      setShowWorkdirDialog(false);
      return;
    }
    setWorkingDir(path.trim());
    fetcher.submit(
      { path: path.trim() },
      { method: "POST", action: "/api/workdir", encType: "application/json" }
    );
    setShowWorkdirDialog(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Task input */}
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4 text-center">
            What should the analyst workspace do next?
          </h2>
          <div className="relative">
            <textarea
              className="input text-base py-4 pr-14 min-h-[120px] resize-none rounded-2xl"
              placeholder="Describe your task…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStartTask();
                }
              }}
              disabled={isSubmitting}
            />
            <button
              onClick={handleStartTask}
              disabled={!prompt.trim() || isSubmitting}
              className="absolute bottom-3 right-3 w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent-hover disabled:opacity-40 transition-colors"
              aria-label="Start task"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={toggleDeepResearch}
              className={`tag text-xs ${deepResearch ? "tag-active" : ""}`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Deep Research
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <button className="card card-hover p-4 text-left" onClick={() => navigate(`/projects/${projectId}/evidence`)}>
            <ScrollText className="w-5 h-5 text-accent mb-3" />
            <div className="text-sm font-medium">Evidence</div>
            <div className="text-xs text-text-muted mt-1">Source-backed findings and citations</div>
          </button>
          <button className="card card-hover p-4 text-left" onClick={() => navigate(`/projects/${projectId}/canvas`)}>
            <PenSquare className="w-5 h-5 text-accent mb-3" />
            <div className="text-sm font-medium">Canvas</div>
            <div className="text-xs text-text-muted mt-1">Draft, compare, and promote deliverables</div>
          </button>
          <button className="card card-hover p-4 text-left" onClick={() => navigate(`/projects/${projectId}/artifacts`)}>
            <Package className="w-5 h-5 text-accent mb-3" />
            <div className="text-sm font-medium">Artifacts</div>
            <div className="text-xs text-text-muted mt-1">Versioned outputs and generated files</div>
          </button>
          <button className="card card-hover p-4 text-left" onClick={() => navigate(`/projects/${projectId}/knowledge`)}>
            <Layers3 className="w-5 h-5 text-accent mb-3" />
            <div className="text-sm font-medium">Sources</div>
            <div className="text-xs text-text-muted mt-1">Collections, imports, and retrieval data</div>
          </button>
        </div>

        {/* Recent runs */}
        {runs.length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
              Recent Runs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {runs.slice(0, 6).map((task) => (
                <button
                  key={task.id}
                  onClick={() =>
                    navigate(`/projects/${projectId}/runs/${task.id}`)
                  }
                  className="card card-hover p-4 text-left"
                >
                  <div className="text-sm font-medium truncate mb-1">
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge ${
                        task.status === "running"
                          ? "badge-running"
                          : task.status === "completed"
                          ? "badge-completed"
                          : task.status === "error"
                          ? "badge-error"
                          : "badge-idle"
                      }`}
                    >
                      {task.status}
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatRelativeTime(task.updatedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Project info bar */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
          <button
            onClick={() => setShowWorkdirDialog(true)}
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            {workingDir || "Set working directory"}
          </button>
          <button
            onClick={() =>
              navigate(`/projects/${projectId}/evidence`)
            }
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Review evidence
          </button>
        </div>
      </div>

      <AlertDialog
        open={showWorkdirDialog}
        title="Set working directory"
        inputLabel="Directory path"
        inputDefaultValue={workingDir || ""}
        confirmLabel="Set"
        onConfirm={confirmWorkdir}
        onCancel={() => setShowWorkdirDialog(false)}
      />
    </div>
  );
}
