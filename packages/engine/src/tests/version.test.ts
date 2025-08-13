import { describe, it, expect } from 'vitest';
import { version } from '@counterpoint/engine';

describe('engine smoke', () => {
  it('exposes a version string', () => {
    expect(typeof version).toBe('string');
  });

  it('does basic math', () => {
    expect(1 + 1).toBe(2);
  });
});
