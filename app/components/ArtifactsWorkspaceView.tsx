import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { headlessGetArtifacts, type HeadlessArtifact } from "~/lib/headless-api";

export function ArtifactsWorkspaceView() {
  const params = useParams();
  const projectId = params.projectId!;
  const [artifacts, setArtifacts] = useState<HeadlessArtifact[]>([]);
  const [versionsByArtifactId, setVersionsByArtifactId] = useState<Record<string, number>>({});

  useEffect(() => {
    headlessGetArtifacts(projectId)
      .then((response) => {
        setArtifacts(response.artifacts);
        setVersionsByArtifactId(response.versionsByArtifactId);
      })
      .catch(() => {
        setArtifacts([]);
        setVersionsByArtifactId({});
      });
  }, [projectId]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-text-muted mb-2">Artifacts</div>
          <h1 className="text-2xl font-semibold">Versioned Deliverables</h1>
          <p className="text-sm text-text-secondary mt-2">
            Generated files, working outputs, and their version history.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {artifacts.length === 0 ? (
            <div className="card p-5 text-sm text-text-muted">No artifacts yet.</div>
          ) : (
            artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="card p-5 text-left"
              >
                <div className="text-sm font-medium">{artifact.title}</div>
                <div className="text-xs text-text-muted mt-1">
                  {artifact.kind} · {artifact.mimeType}
                </div>
                <div className="text-xs text-text-secondary mt-3">
                  {versionsByArtifactId[artifact.id] || 0} versions
                </div>
                {artifact.storageUri && (
                  <div className="text-xs text-text-muted mt-2 break-all">{artifact.storageUri}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
