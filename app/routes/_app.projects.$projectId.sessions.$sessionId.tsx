import { redirect } from "react-router";

export async function loader({
  params,
}: {
  params: { projectId: string; sessionId: string };
}) {
  throw redirect(`/projects/${params.projectId}`);
}

export default function SessionRedirect() {
  return null;
}
