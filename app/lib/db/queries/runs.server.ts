import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../index.server";
import {
  approvals,
  projectRuns,
  projectThreads,
  runSteps,
  type Approval,
  type ProjectRun,
  type ProjectThread,
  type RunStep,
} from "../schema";

export async function listThreads(projectId: string): Promise<ProjectThread[]> {
  return db
    .select()
    .from(projectThreads)
    .where(eq(projectThreads.projectId, projectId))
    .orderBy(desc(projectThreads.updatedAt));
}

export async function createThread(
  projectId: string,
  input: { title?: string; status?: string; summary?: string } = {}
): Promise<ProjectThread> {
  const [thread] = await db
    .insert(projectThreads)
    .values({
      projectId,
      title: String(input.title || "New Thread").trim(),
      status: String(input.status || "idle"),
      summary: String(input.summary || ""),
    })
    .returning();
  return thread;
}

export async function getThread(threadId: string): Promise<ProjectThread | undefined> {
  const [thread] = await db
    .select()
    .from(projectThreads)
    .where(eq(projectThreads.id, threadId))
    .limit(1);
  return thread;
}

export async function ensureThreadForIntent(
  projectId: string,
  intent: string,
  threadId?: string
): Promise<ProjectThread> {
  if (threadId) {
    const existing = await getThread(threadId);
    if (existing && existing.projectId === projectId) {
      return existing;
    }
  }
  return createThread(projectId, {
    title: intent.trim().slice(0, 500) || "New Thread",
    status: "active",
  });
}

export async function listRuns(projectId: string): Promise<ProjectRun[]> {
  return db
    .select()
    .from(projectRuns)
    .where(eq(projectRuns.projectId, projectId))
    .orderBy(desc(projectRuns.updatedAt));
}

export async function getRun(runId: string): Promise<ProjectRun | undefined> {
  const [run] = await db
    .select()
    .from(projectRuns)
    .where(eq(projectRuns.id, runId))
    .limit(1);
  return run;
}

export async function createRun(
  projectId: string,
  input: {
    threadId?: string | null;
    title?: string;
    mode?: string;
    status?: string;
    intent?: string;
    plan?: unknown;
    runtimeState?: unknown;
  } = {}
): Promise<ProjectRun> {
  const now = new Date();
  const [run] = await db
    .insert(projectRuns)
    .values({
      projectId,
      threadId: input.threadId || null,
      title: String(input.title || "New Run").trim(),
      mode: String(input.mode || "chat"),
      status: String(input.status || "queued"),
      intent: String(input.intent || ""),
      plan: input.plan ?? [],
      runtimeState: input.runtimeState ?? {},
      startedAt:
        input.status === "running" || input.status === "completed" ? now : null,
    })
    .returning();
  return run;
}

export async function updateRun(
  runId: string,
  updates: {
    title?: string;
    mode?: string;
    status?: string;
    intent?: string;
    latestOutput?: string;
    plan?: unknown;
    runtimeState?: unknown;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
): Promise<ProjectRun> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof updates.title === "string") values.title = updates.title.trim();
  if (typeof updates.mode === "string") values.mode = updates.mode;
  if (typeof updates.status === "string") values.status = updates.status;
  if (typeof updates.intent === "string") values.intent = updates.intent;
  if (typeof updates.latestOutput === "string") values.latestOutput = updates.latestOutput;
  if (updates.plan !== undefined) values.plan = updates.plan;
  if (updates.runtimeState !== undefined) values.runtimeState = updates.runtimeState;
  if (updates.startedAt !== undefined) values.startedAt = updates.startedAt;
  if (updates.completedAt !== undefined) values.completedAt = updates.completedAt;

  const [run] = await db
    .update(projectRuns)
    .set(values)
    .where(eq(projectRuns.id, runId))
    .returning();
  if (!run) throw new Error(`Run not found: ${runId}`);
  return run;
}

export async function listRunSteps(runId: string): Promise<RunStep[]> {
  return db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, runId))
    .orderBy(asc(runSteps.createdAt));
}

export async function appendRunStep(
  runId: string,
  input: {
    stepType: string;
    actor?: string;
    title: string;
    status?: string;
    payload?: Record<string, unknown>;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
): Promise<RunStep> {
  const [step] = await db
    .insert(runSteps)
    .values({
      runId,
      stepType: input.stepType,
      actor: String(input.actor || "supervisor"),
      title: String(input.title || input.stepType).trim(),
      status: String(input.status || "queued"),
      payload: input.payload || {},
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
    })
    .returning();
  return step;
}

export async function updateRunStep(
  stepId: string,
  updates: {
    title?: string;
    status?: string;
    payload?: Record<string, unknown>;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
): Promise<RunStep> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof updates.title === "string") values.title = updates.title.trim();
  if (typeof updates.status === "string") values.status = updates.status;
  if (updates.payload !== undefined) values.payload = updates.payload;
  if (updates.startedAt !== undefined) values.startedAt = updates.startedAt;
  if (updates.completedAt !== undefined) values.completedAt = updates.completedAt;

  const [step] = await db
    .update(runSteps)
    .set(values)
    .where(eq(runSteps.id, stepId))
    .returning();
  if (!step) throw new Error(`Run step not found: ${stepId}`);
  return step;
}

export async function listApprovals(runId: string): Promise<Approval[]> {
  return db
    .select()
    .from(approvals)
    .where(eq(approvals.runId, runId))
    .orderBy(asc(approvals.createdAt));
}

export async function createApproval(
  runId: string,
  input: {
    stepId?: string | null;
    kind: string;
    title: string;
    description?: string;
    requestPayload?: Record<string, unknown>;
  }
): Promise<Approval> {
  const [approval] = await db
    .insert(approvals)
    .values({
      runId,
      stepId: input.stepId || null,
      kind: input.kind,
      title: input.title,
      description: String(input.description || ""),
      requestPayload: input.requestPayload || {},
    })
    .returning();
  return approval;
}

export async function resolveApproval(
  approvalId: string,
  responsePayload: Record<string, unknown>,
  status: "approved" | "rejected"
): Promise<Approval> {
  const [approval] = await db
    .update(approvals)
    .set({
      status,
      responsePayload,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(approvals.id, approvalId))
    .returning();
  if (!approval) throw new Error(`Approval not found: ${approvalId}`);
  return approval;
}

export async function countActiveRuns(projectId: string): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(projectRuns)
    .where(
      and(
        eq(projectRuns.projectId, projectId),
        sql`${projectRuns.status} in ('queued', 'running', 'waiting_for_approval')`
      )
    );
  return row?.count || 0;
}
