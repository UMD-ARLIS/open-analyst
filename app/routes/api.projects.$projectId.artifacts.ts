import { createArtifact, listArtifacts, listArtifactVersions } from "~/lib/db/queries/workspace.server";
import type { Route } from "./+types/api.projects.$projectId.artifacts";

export async function loader({ params }: Route.LoaderArgs) {
  const artifacts = await listArtifacts(params.projectId);
  const versionsByArtifactId: Record<string, number> = {};
  await Promise.all(
    artifacts.map(async (artifact) => {
      const versions = await listArtifactVersions(params.projectId, artifact.id);
      versionsByArtifactId[artifact.id] = versions.length;
    })
  );
  return Response.json({ artifacts, versionsByArtifactId });
}

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const artifact = await createArtifact(params.projectId, {
    runId: typeof body.runId === "string" ? body.runId : null,
    title: body.title,
    kind: body.kind,
    mimeType: body.mimeType,
    storageUri: body.storageUri,
    metadata: body.metadata,
  });
  return Response.json({ artifact });
}
