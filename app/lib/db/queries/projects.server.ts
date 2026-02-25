import { eq, desc } from "drizzle-orm";
import { db, DEV_USER_ID } from "../index.server";
import {
  projects,
  collections,
  documents,
  tasks,
  type Project,
} from "../schema";

export async function createProject(input: {
  name?: string;
  description?: string;
  datastores?: unknown[];
}): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({
      userId: DEV_USER_ID,
      name: String(input.name || "Untitled Project").trim(),
      description: String(input.description || "").trim(),
      datastores: Array.isArray(input.datastores) ? input.datastores : [],
    })
    .returning();
  return project;
}

export async function listProjects(): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, DEV_USER_ID))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(
  projectId: string
): Promise<Project | undefined> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project;
}

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    description?: string;
    datastores?: unknown[];
  }
): Promise<Project> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof updates.name === "string") {
    values.name = updates.name.trim() || undefined;
  }
  if (typeof updates.description === "string") {
    values.description = updates.description.trim();
  }
  if (Array.isArray(updates.datastores)) {
    values.datastores = updates.datastores;
  }
  // Remove undefined values
  for (const key of Object.keys(values)) {
    if (values[key] === undefined) delete values[key];
  }
  const [project] = await db
    .update(projects)
    .set(values)
    .where(eq(projects.id, projectId))
    .returning();
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}

export async function deleteProject(
  projectId: string
): Promise<{ success: boolean }> {
  const deleted = await db
    .delete(projects)
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id });
  if (!deleted.length) throw new Error(`Project not found: ${projectId}`);
  return { success: true };
}
