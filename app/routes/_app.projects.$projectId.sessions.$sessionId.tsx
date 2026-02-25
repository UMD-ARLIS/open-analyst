import { useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router";
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
  const navigate = useNavigate();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const sessions = useAppStore((s) => s.sessions);

  const sessionExists = sessions.some((s) => s.id === sessionId);

  useEffect(() => {
    setActiveProjectId(projectId);
    if (sessionExists) {
      setActiveSession(sessionId);
    } else {
      // Session is in-memory only — redirect to project root on refresh
      navigate(`/projects/${projectId}`, { replace: true });
    }
  }, [projectId, sessionId, sessionExists, setActiveProjectId, setActiveSession, navigate]);

  if (!sessionExists) return null;

  return <ChatView />;
}
