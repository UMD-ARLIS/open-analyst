import { describe, it, expect } from 'vitest';
import { useAppStore } from '~/lib/store';

describe('store compatibility', () => {
  it('has the expected state keys with correct defaults', () => {
    const state = useAppStore.getState();

    // Core session state
    expect(state).toHaveProperty('sessions');
    expect(state).toHaveProperty('activeSessionId');
    expect(state).toHaveProperty('messagesBySession');

    // Config state
    expect(state).toHaveProperty('isConfigured');
    expect(state).toHaveProperty('appConfig');
    expect(state).toHaveProperty('showConfigModal');

    // Project state
    expect(state).toHaveProperty('projects');
    expect(state).toHaveProperty('activeProjectId');

    // Settings
    expect(state).toHaveProperty('settings');

    // Actions
    expect(typeof state.setActiveSession).toBe('function');
    expect(typeof state.setIsConfigured).toBe('function');
    expect(typeof state.setAppConfig).toBe('function');
    expect(typeof state.setProjects).toBe('function');
    expect(typeof state.setActiveProjectId).toBe('function');
    expect(typeof state.setShowConfigModal).toBe('function');
  });
});
