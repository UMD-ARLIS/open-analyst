import { env } from '~/lib/env.server';
import { listSkills } from '~/lib/skills.server';
import type { Skill } from '~/lib/types';

const RUNTIME_URL = env.LANGGRAPH_RUNTIME_URL;

function fallbackSkills(userId: string): Skill[] {
  return listSkills(userId);
}

function normalizeRuntimeSkill(raw: Record<string, unknown>): Skill | null {
  const id = String(raw.id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(raw.name || id).trim() || id,
    description: String(raw.description || '').trim(),
    type: 'builtin',
    enabled: Boolean(raw.enabled),
    createdAt: Date.now(),
    tools: Array.isArray(raw.tools) ? raw.tools.map((item) => String(item)) : [],
    source: raw.source && typeof raw.source === 'object'
      ? {
          kind:
            String((raw.source as Record<string, unknown>).kind || '').trim() === 'repository'
              ? 'repository'
              : String((raw.source as Record<string, unknown>).kind || '').trim() === 'custom'
                ? 'custom'
                : 'builtin',
          path:
            typeof (raw.source as Record<string, unknown>).path === 'string'
              ? String((raw.source as Record<string, unknown>).path)
              : undefined,
        }
      : {
          kind:
            String(raw.source_kind || '').trim() === 'repository'
              ? 'repository'
              : String(raw.source_kind || '').trim() === 'custom'
                ? 'custom'
                : 'builtin',
        },
    config: {},
  };
}

export async function listRuntimeSkills(input: {
  userId: string;
  projectId?: string;
}): Promise<Skill[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const target = new URL('/skills', `${RUNTIME_URL}/`);
    if (input.projectId) {
      target.searchParams.set('project_id', input.projectId);
    }
    const response = await fetch(target, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return fallbackSkills(input.userId);
    }
    const payload = (await response.json()) as { skills?: unknown };
    if (!Array.isArray(payload.skills)) {
      return fallbackSkills(input.userId);
    }
    const skills = payload.skills
      .map((item) => (item && typeof item === 'object' ? normalizeRuntimeSkill(item as Record<string, unknown>) : null))
      .filter((item): item is Skill => item !== null);
    return skills.length > 0 ? skills : fallbackSkills(input.userId);
  } catch {
    return fallbackSkills(input.userId);
  } finally {
    clearTimeout(timeout);
  }
}
