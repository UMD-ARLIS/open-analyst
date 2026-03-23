import {
  listCollections,
  listDocuments,
  getCollectionDocumentCounts,
} from "~/lib/db/queries/documents.server";
import { listSourceIngestBatches } from "~/lib/db/queries/source-ingest.server";
import type { Route } from "./+types/api.projects.$projectId.knowledge";

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const collectionId = url.searchParams.get("collectionId") || undefined;
  const [collections, documents, documentCounts, sourceIngestBatches] = await Promise.all([
    listCollections(params.projectId),
    listDocuments(params.projectId, collectionId),
    getCollectionDocumentCounts(params.projectId),
    listSourceIngestBatches(params.projectId, {
      statuses: ["staged", "importing", "failed"],
    }),
  ]);
  return { collections, documents, documentCounts, sourceIngestBatches };
}
