import { describe, it, expect } from 'vitest';
import { getHeadlessApiBase } from '~/lib/headless-api';

describe('headless-api rewrite', () => {
  it('getHeadlessApiBase() returns empty string (same-origin)', () => {
    expect(getHeadlessApiBase()).toBe('');
  });
});
