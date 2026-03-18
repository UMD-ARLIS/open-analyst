import { useEffect, useState } from "react";
import { useParams } from "react-router";

interface EvidenceItem {
  id: string;
  title: string;
  evidenceType: string;
  sourceUri?: string | null;
  citationText: string;
  extractedText: string;
  confidence: string;
}

export function EvidenceWorkspaceView() {
  const params = useParams();
  const projectId = params.projectId!;
  const [items, setItems] = useState<EvidenceItem[]>([]);

  useEffect(() => {
    void fetch(`/api/projects/${encodeURIComponent(projectId)}/evidence`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error || `HTTP ${response.status}`);
        }
        return Array.isArray(body.evidence) ? body.evidence as EvidenceItem[] : [];
      })
      .then(setItems)
      .catch(() => setItems([]));
  }, [projectId]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-text-muted mb-2">Evidence</div>
          <h1 className="text-2xl font-semibold">Project Evidence</h1>
          <p className="text-sm text-text-secondary mt-2">
            Source-backed findings, extracted text, and confidence signals for this project.
          </p>
        </div>

        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="card p-5 text-sm text-text-muted">No evidence has been recorded yet.</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-text-muted mt-1">
                      {item.evidenceType} · confidence {item.confidence}
                    </div>
                  </div>
                  {item.sourceUri && (
                    <a href={item.sourceUri} target="_blank" rel="noreferrer" className="text-xs text-accent">
                      Open source
                    </a>
                  )}
                </div>
                {item.citationText && (
                  <div className="text-sm text-text-secondary mt-3">{item.citationText}</div>
                )}
                {item.extractedText && (
                  <div className="text-sm leading-7 mt-3 whitespace-pre-wrap">{item.extractedText}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
