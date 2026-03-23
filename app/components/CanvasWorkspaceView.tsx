import { useEffect, useState } from "react";
import { useParams } from "react-router";
import {
  headlessCreateCanvasDocument,
  headlessGetCanvasDocuments,
  type HeadlessCanvasDocument,
} from "~/lib/headless-api";

export function CanvasWorkspaceView() {
  const params = useParams();
  const projectId = params.projectId!;
  const [documents, setDocuments] = useState<HeadlessCanvasDocument[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    let active = true;

    void headlessGetCanvasDocuments(projectId)
      .then((next) => {
        if (active) setDocuments(next);
      })
      .catch(() => {
        if (active) setDocuments([]);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-text-muted mb-2">Canvas</div>
          <h1 className="text-2xl font-semibold">Canvas Documents</h1>
          <p className="text-sm text-text-secondary mt-2">
            Draft and iterate on analyst deliverables in project-native documents.
          </p>
        </div>

        <div className="card p-5">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              className="input flex-1"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Create a new canvas document"
            />
            <button
              className="btn btn-primary"
              onClick={async () => {
                const trimmed = title.trim();
                if (!trimmed) return;
                await headlessCreateCanvasDocument(projectId, {
                  title: trimmed,
                  documentType: "markdown",
                  content: { markdown: `# ${trimmed}\n\n` },
                });
                setTitle("");
                const next = await headlessGetCanvasDocuments(projectId);
                setDocuments(next);
              }}
            >
              Create Canvas Doc
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="card p-5 text-sm text-text-muted">No canvas documents yet.</div>
          ) : (
            documents.map((document) => (
              <div key={document.id} className="card p-5">
                <div className="text-sm font-medium">{document.title}</div>
                <div className="text-xs text-text-muted mt-1">{document.documentType}</div>
                {"markdown" in (document.content || {}) && (
                  <pre className="mt-4 text-xs whitespace-pre-wrap overflow-x-auto">
                    {String((document.content as Record<string, unknown>).markdown || "")}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
