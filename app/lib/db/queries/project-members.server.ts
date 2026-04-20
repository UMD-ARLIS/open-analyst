import { queryRow, queryRows } from '../index.server';
import type { ProjectMember } from '../schema';
import { ensureAppUsersTable } from './app-users.server';

export type ProjectAccessRole = 'owner' | 'editor' | 'viewer';

let ensurePromise: Promise<void> | null = null;

export async function ensureProjectMembersTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await ensureAppUsersTable();
      await queryRow(`
        CREATE TABLE IF NOT EXISTS project_members (
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
          added_by_user_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (project_id, user_id)
        )
      `);

      await queryRow(
        `CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members (user_id)`
      );
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

function normalizeMemberRole(value: string | null | undefined): 'editor' | 'viewer' {
  return String(value || '').trim().toLowerCase() === 'viewer' ? 'viewer' : 'editor';
}

export function hasProjectRole(
  actual: ProjectAccessRole | null | undefined,
  minimum: ProjectAccessRole
): boolean {
  const rank: Record<ProjectAccessRole, number> = {
    viewer: 1,
    editor: 2,
    owner: 3,
  };
  if (!actual) return false;
  return rank[actual] >= rank[minimum];
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  await ensureProjectMembersTable();
  return queryRows<ProjectMember>(
    `
      SELECT
        p.id AS project_id,
        p.user_id,
        'owner'::text AS role,
        owner.email,
        owner.name,
        owner.username,
        NULL::text AS added_by_user_id,
        p.created_at,
        p.updated_at,
        owner.last_seen_at,
        TRUE AS is_owner
      FROM projects p
      LEFT JOIN app_users owner ON owner.user_id = p.user_id
      WHERE p.id = $1

      UNION ALL

      SELECT
        pm.project_id,
        pm.user_id,
        pm.role,
        au.email,
        au.name,
        au.username,
        pm.added_by_user_id,
        pm.created_at,
        pm.updated_at,
        au.last_seen_at,
        FALSE AS is_owner
      FROM project_members pm
      LEFT JOIN app_users au ON au.user_id = pm.user_id
      WHERE pm.project_id = $1

      ORDER BY
        is_owner DESC,
        CASE role WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 3 END DESC,
        created_at ASC
    `,
    [projectId]
  );
}

export async function getProjectMember(
  projectId: string,
  userId: string
): Promise<ProjectMember | undefined> {
  await ensureProjectMembersTable();
  return queryRow<ProjectMember>(
    `
      SELECT *
      FROM (
        SELECT
          p.id AS project_id,
          p.user_id,
          'owner'::text AS role,
          owner.email,
          owner.name,
          owner.username,
          NULL::text AS added_by_user_id,
          p.created_at,
          p.updated_at,
          owner.last_seen_at,
          TRUE AS is_owner
        FROM projects p
        LEFT JOIN app_users owner ON owner.user_id = p.user_id
        WHERE p.id = $1 AND p.user_id = $2

        UNION ALL

        SELECT
          pm.project_id,
          pm.user_id,
          pm.role,
          au.email,
          au.name,
          au.username,
          pm.added_by_user_id,
          pm.created_at,
          pm.updated_at,
          au.last_seen_at,
          FALSE AS is_owner
        FROM project_members pm
        LEFT JOIN app_users au ON au.user_id = pm.user_id
        WHERE pm.project_id = $1 AND pm.user_id = $2
      ) AS member_rows
      LIMIT 1
    `,
    [projectId, userId]
  );
}

export async function upsertProjectMember(
  projectId: string,
  userId: string,
  role: 'editor' | 'viewer',
  addedByUserId: string
): Promise<ProjectMember> {
  await ensureProjectMembersTable();
  await queryRow(
    `
      INSERT INTO project_members (project_id, user_id, role, added_by_user_id, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (project_id, user_id) DO UPDATE
      SET
        role = EXCLUDED.role,
        added_by_user_id = EXCLUDED.added_by_user_id,
        updated_at = NOW()
    `,
    [projectId, userId, normalizeMemberRole(role), addedByUserId]
  );
  const member = await getProjectMember(projectId, userId);
  if (!member) throw new Error(`Failed to save project member ${userId}`);
  return member;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await ensureProjectMembersTable();
  await queryRow(
    `
      DELETE FROM project_members
      WHERE project_id = $1 AND user_id = $2
    `,
    [projectId, userId]
  );
}
