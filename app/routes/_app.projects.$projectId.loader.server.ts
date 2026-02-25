import { redirect } from "react-router";
import { getProject } from "~/lib/db/queries/projects.server";
import { upsertSettings } from "~/lib/db/queries/settings.server";

export async function loader({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) {
    throw redirect("/");
  }
  await upsertSettings({ activeProjectId: params.projectId });
  return { projectId: params.projectId };
}
