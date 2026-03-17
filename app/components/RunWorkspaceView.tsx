import { startTransition, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  headlessApproveRun,
  headlessGetEvidence,
  headlessGetRun,
  headlessGetRunSteps,
  headlessInterruptRun,
  headlessStreamRun,
  type HeadlessApproval,
  type HeadlessEvidenceItem,
  type HeadlessRun,
  type HeadlessRunStep,
  type HeadlessRunStreamEvent,
} from "~/lib/headless-api";
import { CheckCircle2, Hand, Square, Workflow } from "lucide-react";

export function RunWorkspaceView() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = params.projectId!;
  const runId = params.runId!;
  const [run, setRun] = useState<HeadlessRun | null>(null);
  const [steps, setSteps] = useState<HeadlessRunStep[]>([]);
  const [evidence, setEvidence] = useState<HeadlessEvidenceItem[]>([]);
  const [approvals, setApprovals] = useState<HeadlessApproval[]>([]);
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [runResponse, nextSteps, nextEvidence] = await Promise.all([
        headlessGetRun(projectId, runId),
        headlessGetRunSteps(projectId, runId),
        headlessGetEvidence(projectId, { runId }),
      ]);

      if (cancelled) return;
      setRun(runResponse.run);
      setApprovals(runResponse.approvals);
      setSteps(nextSteps);
      setEvidence(nextEvidence);

      if (
        runResponse.run &&
        (runResponse.run.status === "queued" || runResponse.run.status === "running")
      ) {
        setIsStreaming(true);
        await headlessStreamRun(projectId, runId, (event: HeadlessRunStreamEvent) => {
          startTransition(() => {
            if (event.type === "text_delta" && event.text) {
              setStreamedText((current) => current + event.text);
            }
          });
        });
        const [refreshedRun, refreshedSteps, refreshedEvidence] = await Promise.all([
          headlessGetRun(projectId, runId),
          headlessGetRunSteps(projectId, runId),
          headlessGetEvidence(projectId, { runId }),
        ]);
        if (!cancelled) {
          setRun(refreshedRun.run);
          setApprovals(refreshedRun.approvals);
          setSteps(refreshedSteps);
          setEvidence(refreshedEvidence);
          setIsStreaming(false);
        }
      }
    }

    load().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
        setIsStreaming(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, runId]);

  const displayedOutput = streamedText || run?.latestOutput || "";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-text-muted mb-2">
              Run
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">
              {run?.title || "Analyst Run"}
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-3xl">
              {run?.intent || "Loading run intent..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary text-sm"
              onClick={() => navigate(`/projects/${projectId}/evidence`)}
            >
              <Workflow className="w-4 h-4" />
              Evidence
            </button>
            <button
              className="btn btn-secondary text-sm"
              onClick={async () => {
                await headlessInterruptRun(projectId, runId, "user_requested_stop");
                const refreshed = await headlessGetRun(projectId, runId);
                setRun(refreshed.run);
              }}
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Current Output</h2>
              <span className="badge badge-idle">{isStreaming ? "Streaming" : run?.status || "idle"}</span>
            </div>
            <div className="rounded-xl bg-surface-muted border border-border min-h-[420px] p-4 whitespace-pre-wrap text-sm leading-7">
              {displayedOutput || "This run has not produced output yet."}
            </div>
          </section>

          <section className="space-y-6">
            <div className="card p-5">
              <h2 className="text-lg font-semibold mb-4">Run Timeline</h2>
              <div className="space-y-3">
                {steps.length === 0 ? (
                  <div className="text-sm text-text-muted">No steps recorded yet.</div>
                ) : (
                  steps.map((step) => (
                    <div key={step.id} className="rounded-xl border border-border px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{step.title}</div>
                          <div className="text-xs text-text-muted mt-1">
                            {step.actor} · {step.stepType}
                          </div>
                        </div>
                        <span className="badge badge-idle">{step.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-lg font-semibold mb-4">Evidence Bundle</h2>
              <div className="space-y-3">
                {evidence.length === 0 ? (
                  <div className="text-sm text-text-muted">No evidence gathered yet.</div>
                ) : (
                  evidence.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border px-3 py-3">
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-text-muted mt-1">{item.evidenceType}</div>
                      {item.citationText && (
                        <div className="text-xs text-text-secondary mt-2">{item.citationText}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {approvals.length > 0 && (
              <div className="card p-5">
                <h2 className="text-lg font-semibold mb-4">Approvals</h2>
                <div className="space-y-3">
                  {approvals.map((approval) => (
                    <div key={approval.id} className="rounded-xl border border-border px-3 py-3">
                      <div className="text-sm font-medium">{approval.title}</div>
                      <div className="text-xs text-text-muted mt-1">{approval.description}</div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          className="btn btn-secondary text-sm"
                          onClick={async () => {
                            await headlessApproveRun(projectId, runId, approval.id, true);
                            const refreshed = await headlessGetRun(projectId, runId);
                            setApprovals(refreshed.approvals);
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          className="btn btn-secondary text-sm"
                          onClick={async () => {
                            await headlessApproveRun(projectId, runId, approval.id, false);
                            const refreshed = await headlessGetRun(projectId, runId);
                            setApprovals(refreshed.approvals);
                          }}
                        >
                          <Hand className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
