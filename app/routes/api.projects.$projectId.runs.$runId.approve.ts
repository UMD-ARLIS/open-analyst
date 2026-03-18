import { listApprovals, resolveApproval, getRun } from "~/lib/db/queries/runs.server";
import { resumeRun } from "~/lib/runtime-client.server";
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
  const decision: "approve" | "reject" =
    body.decision === "reject" || body.approved === false ? "reject" : "approve";

  // If an approvalId is provided, resolve it in the local DB
  const approvalId = String(body.approvalId || "").trim();
  if (approvalId) {
    const approvals = await listApprovals(run.id);
    const approval = approvals.find((item) => item.id === approvalId);
    if (!approval) {
      return Response.json({ error: `Approval not found: ${approvalId}` }, { status: 404 });
    }
    await resolveApproval(
      approval.id,
      body.response && typeof body.response === "object" ? body.response : {},
      decision === "reject" ? "rejected" : "approved"
    );
  }

  // Resume the interrupted runtime run
  const runtimeRes = await resumeRun({
    run_id: params.runId,
    thread_id: params.runId,
    decision,
    project: body.project && typeof body.project === "object" ? body.project : {},
  });
  const result = await runtimeRes.json();

  return Response.json({ status: result.status, text: result.text });
}
