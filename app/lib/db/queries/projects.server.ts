import { randomUUID } from 'crypto';
import { queryRow, queryRows } from '../index.server';
import { type Project } from '../schema';
import { buildProjectWorkspaceSlug } from '~/lib/project-storage.server';
import { ensureProjectMembersTable } from './project-members.server';

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function createProject(
  input: {
    name?: string;
    description?: string;
    datastores?: unknown[];
    workspaceLocalRoot?: string | null;
    artifactBackend?: string | null;
    artifactLocalRoot?: string | null;
    artifactS3Bucket?: string | null;
    artifactS3Region?: string | null;
    artifactS3Endpoint?: string | null;
    artifactS3Prefix?: string | null;
  },
  userId: string,
): Promise<Project> {
  const id = randomUUID();
  const trimmedName = String(input.name || 'Untitled Project').trim();
  const project = await queryRow<Project>(
    `
      INSERT INTO projects (
        id,
        user_id,
        name,
        description,
        datastores,
        workspace_slug,
        workspace_local_root,
        artifact_backend,
        artifact_local_root,
        artifact_s3_bucket,
        artifact_s3_region,
        artifact_s3_endpoint,
        artifact_s3_prefix
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
    [
      id,
      userId,
      trimmedName,
      String(input.description || '').trim(),
      JSON.stringify(Array.isArray(input.datastores) ? input.datastores : []),
      buildProjectWorkspaceSlug(trimmedName, id),
      trimOrNull(input.workspaceLocalRoot),
      input.artifactBackend === 'local' || input.artifactBackend === 's3'
        ? input.artifactBackend
        : 'env',
      trimOrNull(input.artifactLocalRoot),
      trimOrNull(input.artifactS3Bucket),
      trimOrNull(input.artifactS3Region),
      trimOrNull(input.artifactS3Endpoint),
      trimOrNull(input.artifactS3Prefix),
    ]
  );
  if (!project) throw new Error('Project insert failed');
  return project;
}

export async function listProjects(userId: string): Promise<Project[]> {
  await ensureProjectMembersTable();
  return queryRows<Project>(
    `
      SELECT
        projects.*,
        CASE
          WHEN projects.user_id = $1 THEN 'owner'
          ELSE project_members.role
        END AS access_role,
        (projects.user_id = $1) AS is_owner
      FROM projects
      LEFT JOIN project_members
        ON project_members.project_id = projects.id
       AND project_members.user_id = $1
      WHERE projects.user_id = $1
         OR project_members.user_id = $1
      ORDER BY updated_at DESC
    `,
    [userId]
  );
}

export async function getProject(projectId: string, userId: string): Promise<Project | undefined> {
  await ensureProjectMembersTable();
  return queryRow<Project>(
    `
      SELECT
        projects.*,
        CASE
          WHEN projects.user_id = $2 THEN 'owner'
          ELSE project_members.role
        END AS access_role,
        (projects.user_id = $2) AS is_owner
      FROM projects
      LEFT JOIN project_members
        ON project_members.project_id = projects.id
       AND project_members.user_id = $2
      WHERE projects.id = $1
        AND (
          projects.user_id = $2
          OR project_members.user_id = $2
        )
      LIMIT 1
    `,
    [projectId, userId]
  );
}

export async function getProjectById(projectId: string): Promise<Project | undefined> {
  return queryRow<Project>(
    `
      SELECT *
      FROM projects
      WHERE id = $1
      LIMIT 1
    `,
    [projectId]
  );
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    datastores?: unknown[];
    workspaceLocalRoot?: string | null;
    artifactBackend?: string | null;
    artifactLocalRoot?: string | null;
    artifactS3Bucket?: string | null;
    artifactS3Region?: string | null;
    artifactS3Endpoint?: string | null;
    artifactS3Prefix?: string | null;
  }
): Promise<Project> {
  const clauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (typeof updates.name === 'string') {
    params.push(updates.name.trim() || 'Untitled Project');
    clauses.push(`name = $${params.length}`);
  }
  if (typeof updates.description === 'string') {
    params.push(updates.description.trim());
    clauses.push(`description = $${params.length}`);
  }
  if (Array.isArray(updates.datastores)) {
    params.push(JSON.stringify(updates.datastores));
    clauses.push(`datastores = $${params.length}::jsonb`);
  }
  if (updates.workspaceLocalRoot !== undefined) {
    params.push(trimOrNull(updates.workspaceLocalRoot));
    clauses.push(`workspace_local_root = $${params.length}`);
  }
  if (updates.artifactBackend !== undefined) {
    params.push(
      updates.artifactBackend === 'local' || updates.artifactBackend === 's3'
        ? updates.artifactBackend
        : 'env'
    );
    clauses.push(`artifact_backend = $${params.length}`);
  }
  if (updates.artifactLocalRoot !== undefined) {
    params.push(trimOrNull(updates.artifactLocalRoot));
    clauses.push(`artifact_local_root = $${params.length}`);
  }
  if (updates.artifactS3Bucket !== undefined) {
    params.push(trimOrNull(updates.artifactS3Bucket));
    clauses.push(`artifact_s3_bucket = $${params.length}`);
  }
  if (updates.artifactS3Region !== undefined) {
    params.push(trimOrNull(updates.artifactS3Region));
    clauses.push(`artifact_s3_region = $${params.length}`);
  }
  if (updates.artifactS3Endpoint !== undefined) {
    params.push(trimOrNull(updates.artifactS3Endpoint));
    clauses.push(`artifact_s3_endpoint = $${params.length}`);
  }
  if (updates.artifactS3Prefix !== undefined) {
    params.push(trimOrNull(updates.artifactS3Prefix));
    clauses.push(`artifact_s3_prefix = $${params.length}`);
  }

  params.push(projectId);
  const project = await queryRow<Project>(
    `
      UPDATE projects
      SET ${clauses.join(', ')}
      WHERE id = $${params.length}
        AND user_id = $${params.length + 1}
      RETURNING *
    `,
    [...params, userId]
  );
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}

export async function deleteProject(projectId: string, userId: string): Promise<{ success: boolean }> {
  const deleted = await queryRow<{ id: string }>(
    `
      DELETE FROM projects
      WHERE id = $1
        AND user_id = $2
      RETURNING id
    `,
    [projectId, userId]
  );
  if (!deleted) throw new Error(`Project not found: ${projectId}`);
  return { success: true };
}
