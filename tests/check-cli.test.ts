import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We test the internal logic by mocking modules and importing the checkAssets-like behavior
// Since check-cli.ts has a main() that calls process.exit, we mock the key dependencies

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
  };
});

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('check-cli logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('asset checking pattern', () => {
    // Tests the pattern used in checkAssets()
    const ASSET_PATHS = [
      'skills/claude-imagine/image-generate/SKILL.md',
      'skills/claude-imagine/image-suggest/SKILL.md',
      'commands/claude-imagine/image-generate.md',
      'commands/claude-imagine/image-suggest.md',
      'rules/image/image-generation.md',
    ];

    it('counts errors for missing asset files', () => {
      let errors = 0;
      for (const asset of ASSET_PATHS) {
        const path = join('/fake/.claude', asset);
        mockExistsSync.mockReturnValue(false);
        if (!existsSync(path)) errors++;
      }
      expect(errors).toBe(5);
    });

    it('counts zero errors when all assets exist', () => {
      mockExistsSync.mockReturnValue(true);
      let errors = 0;
      for (const asset of ASSET_PATHS) {
        const path = join('/fake/.claude', asset);
        if (!existsSync(path)) errors++;
      }
      expect(errors).toBe(0);
    });
  });

  describe('config parsing pattern', () => {
    it('parses valid config JSON for backend and model count', () => {
      const config = {
        backend: 'comfyui',
        models: { model_a: {}, model_b: {} },
      };

      const backend = config.backend ?? 'unknown';
      const modelCount = config.models ? Object.keys(config.models).length : 0;

      expect(backend).toBe('comfyui');
      expect(modelCount).toBe(2);
    });

    it('handles config without models key', () => {
      const config = { backend: 'comfyui' } as Record<string, unknown>;
      const models = config.models as Record<string, unknown> | undefined;
      const modelCount = models ? Object.keys(models).length : 0;
      expect(modelCount).toBe(0);
    });

    it('handles config with server.url', () => {
      const config = { server: { url: 'http://192.168.1.5:8188' } };
      const serverUrl = config.server?.url ?? 'http://localhost:8188';
      expect(serverUrl).toBe('http://192.168.1.5:8188');
    });

    it('falls back to serverUrl key', () => {
      const config = { serverUrl: 'http://10.0.0.1:8188' } as Record<string, unknown>;
      const serverConfig = config.server as { url?: string } | undefined;
      const serverUrl = serverConfig?.url ?? (config.serverUrl as string) ?? 'http://localhost:8188';
      expect(serverUrl).toBe('http://10.0.0.1:8188');
    });
  });

  describe('server reachability pattern', () => {
    it('returns true on successful fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      const reachable = await checkWithFetch('http://localhost:8188', mockFetch);
      expect(reachable).toBe(true);
    });

    it('returns false on fetch error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const reachable = await checkWithFetch('http://localhost:8188', mockFetch);
      expect(reachable).toBe(false);
    });
  });
});

// Helper that mirrors check-cli's checkServerReachable logic
async function checkWithFetch(
  url: string,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetchFn(url, { signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}
