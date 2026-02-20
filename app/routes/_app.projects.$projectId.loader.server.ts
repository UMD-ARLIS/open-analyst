import { redirect } from "react-router";
import { createProjectStore } from "~/lib/project-store.server";

export async function loader({ params }: { params: { projectId: string } }) {
  const store = createProjectStore();
  const project = store.getProject(params.projectId);
  if (!project) {
    throw redirect("/");
  }
  store.setActiveProject(params.projectId);
  return { projectId: params.projectId };
}
