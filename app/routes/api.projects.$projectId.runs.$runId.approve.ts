import { listApprovals, resolveApproval, getRun } from "~/lib/db/queries/runs.server";
import type { Route } from "./+types/api.projects.$projectId.runs.$runId.approve";

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const run = await getRun(params.runId);
  if (!run || run.projectId !== params.projectId) {
    return Response.json({ error: `Run not found: ${params.runId}` }, { status: 404 });
  }
  const body = await request.json();
  const approvalId = String(body.approvalId || "").trim();
  if (!approvalId) {
    return Response.json({ error: "approvalId is required" }, { status: 400 });
  }
  const approvals = await listApprovals(run.id);
  const approval = approvals.find((item) => item.id === approvalId);
  if (!approval) {
    return Response.json({ error: `Approval not found: ${approvalId}` }, { status: 404 });
  }
  const next = await resolveApproval(
    approval.id,
    body.response && typeof body.response === "object" ? body.response : {},
    body.approved === false ? "rejected" : "approved"
  );
  return Response.json({ approval: next });
}
