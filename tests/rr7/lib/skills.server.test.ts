import { describe, expect, it } from 'vitest';
import { selectMatchedSkills } from '~/lib/skills.server';
import type { Skill } from '~/lib/types';

const baseSkill = (overrides: Partial<Skill>): Skill => ({
  id: overrides.id || 'skill-id',
  name: overrides.name || 'Skill',
  description: overrides.description,
  type: 'builtin',
  enabled: true,
  createdAt: Date.now(),
  config: {},
  instructions: overrides.instructions,
  tools: overrides.tools || [],
  source: overrides.source,
});

describe('selectMatchedSkills', () => {
  it('prioritizes file-specific skills from prompt extensions', () => {
    const skills = [
      baseSkill({
        id: 'xlsx',
        name: 'Spreadsheet',
        description: 'Work with xlsx spreadsheets',
        source: { kind: 'repository', path: '/tmp/xlsx' },
      }),
      baseSkill({
        id: 'docx',
        name: 'Document',
        description: 'Work with docx files',
        source: { kind: 'repository', path: '/tmp/docx' },
      }),
    ];

    const matched = selectMatchedSkills(skills, {
      prompt: 'Summarize the attached budget.xlsx and preserve formulas.',
    });

    expect(matched.map((skill) => skill.id)).toEqual(['xlsx']);
  });

  it('uses the broader user history instead of only the latest token match', () => {
    const skills = [
      baseSkill({
        id: 'research',
        name: 'Web Research',
        description: 'Search the web and synthesize sources',
        tools: ['web_search'],
      }),
    ];

    const matched = selectMatchedSkills(skills, {
      messages: [
        { role: 'user', content: 'Research the latest drone defense reporting' },
        { role: 'assistant', content: 'I can help with that.' },
      ],
    });

    expect(matched.map((skill) => skill.id)).toEqual(['research']);
  });
});
