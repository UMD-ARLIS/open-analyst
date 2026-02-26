import { useLoaderData } from "react-router";

export { loader } from "./_app.projects.$projectId.knowledge.loader.server";

export default function KnowledgeRoute() {
  const { projectId, collections } = useLoaderData<{
    projectId: string;
    collections: Array<{ id: string; name: string }>;
  }>();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold mb-4">Knowledge</h1>
      <p className="text-text-secondary text-sm">
        {collections.length} collection{collections.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
