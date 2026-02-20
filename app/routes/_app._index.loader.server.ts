import { redirect } from "react-router";
import { createProjectStore } from "~/lib/project-store.server";

export async function loader() {
  const store = createProjectStore();
  const active = store.getActiveProject();
  if (active) {
    throw redirect(`/projects/${active.id}`);
  }
  return { noProjects: true };
}
