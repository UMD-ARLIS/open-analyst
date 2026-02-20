import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { useAppStore } from "~/lib/store";
import { ChatView } from "~/components/ChatView";

export async function loader({
  params,
}: {
  params: { projectId: string; sessionId: string };
}) {
  return { projectId: params.projectId, sessionId: params.sessionId };
}

export default function SessionRoute() {
  const { projectId, sessionId } = useLoaderData<{
    projectId: string;
    sessionId: string;
  }>();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  useEffect(() => {
    setActiveProjectId(projectId);
    setActiveSession(sessionId);
  }, [projectId, sessionId, setActiveProjectId, setActiveSession]);

  return <ChatView />;
}
