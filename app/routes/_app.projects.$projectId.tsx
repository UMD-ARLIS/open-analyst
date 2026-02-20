import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { useAppStore } from "~/lib/store";
import { WelcomeView } from "~/components/WelcomeView";

export { loader } from "./_app.projects.$projectId.loader.server";

export default function ProjectRoute() {
  const { projectId } = useLoaderData<{ projectId: string }>();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  useEffect(() => {
    setActiveProjectId(projectId);
    setActiveSession(null);
  }, [projectId, setActiveProjectId, setActiveSession]);

  return <WelcomeView />;
}
