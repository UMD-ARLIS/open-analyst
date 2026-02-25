import {
  listDocuments,
  createDocument,
} from "~/lib/db/queries/documents.server";
import type { Route } from "./+types/api.projects.$projectId.documents";

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const collectionId = url.searchParams.get("collectionId") || "";
  const documents = await listDocuments(
    params.projectId,
    collectionId || undefined
  );
  return Response.json({ documents });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const document = await createDocument(params.projectId, {
    collectionId: body.collectionId,
    title: body.title,
    sourceType: body.sourceType,
    sourceUri: body.sourceUri,
    content: body.content,
    metadata: body.metadata,
  });
  return Response.json({ document }, { status: 201 });
}
