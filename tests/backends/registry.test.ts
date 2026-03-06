import { describe, it, expect } from 'vitest';
import { registerBackend, getBackend, getRegisteredBackends } from '../../src/backends/registry.js';
import type { ImageBackend } from '../../src/backends/types.js';

const mockBackend: ImageBackend = {
  name: 'test_backend',
  detect: async () => true,
  discoverModels: async () => [],
  generate: async () => ({ imageBytes: new Uint8Array(), metadata: { model: 'test', elapsedMs: 0 } }),
  checkHealth: async () => true,
};

describe('Backend Registry', () => {
  it('registers and retrieves a backend', () => {
    registerBackend(mockBackend);
    expect(getBackend('test_backend')).toBe(mockBackend);
  });

  it('returns undefined for unknown backend', () => {
    expect(getBackend('nonexistent')).toBeUndefined();
  });

  it('lists all registered backends', () => {
    const backends = getRegisteredBackends();
    expect(backends.length).toBeGreaterThanOrEqual(1);
    expect(backends.some(b => b.name === 'test_backend')).toBe(true);
  });
});
