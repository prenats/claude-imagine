import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, DEFAULT_SERVER_URL } from '../src/config.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `claude-imagine-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Defaults', () => {
  it('uses the default server URL when no config exists', () => {
    const cfg = loadConfig({}, '/nonexistent/config.json');
    expect(cfg.serverUrl).toBe(DEFAULT_SERVER_URL);
  });

  it('has empty models when no config exists', () => {
    const cfg = loadConfig({}, '/nonexistent/config.json');
    expect(Object.keys(cfg.models).length).toBe(0);
  });

  it('has empty image type assignments when no config exists', () => {
    const cfg = loadConfig({}, '/nonexistent/config.json');
    expect(Object.keys(cfg.imageTypes).length).toBe(0);
  });

  it('defaults backend to comfyui', () => {
    const cfg = loadConfig({}, '/nonexistent/config.json');
    expect(cfg.backend).toBe('comfyui');
  });

  it('does not throw when config file is missing', () => {
    const cfg = loadConfig({}, '/tmp/does_not_exist.json');
    expect(cfg).toBeDefined();
  });
});

describe('Environment variables', () => {
  it('IMAGINE_SERVER_URL overrides the default', () => {
    const cfg = loadConfig({ IMAGINE_SERVER_URL: 'http://localhost:9999' }, '/nonexistent/config.json');
    expect(cfg.serverUrl).toBe('http://localhost:9999');
  });

  it('IMAGINE_SERVER_URL overrides config file URL', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({ server: { url: 'http://toml-host:8188' } }));

    const cfg = loadConfig({ IMAGINE_SERVER_URL: 'http://env-host:8188' }, configFile);
    expect(cfg.serverUrl).toBe('http://env-host:8188');

    rmSync(dir, { recursive: true });
  });

  it('IMAGINE_BACKEND overrides config file backend', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({ backend: 'comfyui' }));

    const cfg = loadConfig({ IMAGINE_BACKEND: 'a1111' }, configFile);
    expect(cfg.backend).toBe('a1111');

    rmSync(dir, { recursive: true });
  });
});

describe('JSON config file', () => {
  it('reads server URL from server.url', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({ server: { url: 'http://192.168.1.100:8188' } }));

    const cfg = loadConfig({}, configFile);
    expect(cfg.serverUrl).toBe('http://192.168.1.100:8188');

    rmSync(dir, { recursive: true });
  });

  it('reads serverUrl from top-level key', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({ serverUrl: 'http://10.0.0.2:8188' }));

    const cfg = loadConfig({}, configFile);
    expect(cfg.serverUrl).toBe('http://10.0.0.2:8188');

    rmSync(dir, { recursive: true });
  });

  it('reads models as ModelDefinition objects', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      backend: 'comfyui',
      server: { url: 'http://10.0.0.1:8188' },
      models: {
        my_model: {
          filename: 'my_model.safetensors',
          displayName: 'My Model',
          type: 'checkpoint',
          tier: 'standard',
          params: { steps: 20, cfg: 7.0, sampler: 'euler', scheduler: 'normal' },
        },
      },
      imageTypes: {
        ICON: { model: 'my_model' },
      },
    }));

    const cfg = loadConfig({}, configFile);
    expect(cfg.backend).toBe('comfyui');
    expect(cfg.serverUrl).toBe('http://10.0.0.1:8188');
    expect(cfg.models['my_model']).toBeDefined();
    expect(cfg.models['my_model'].filename).toBe('my_model.safetensors');
    expect(cfg.imageTypes['ICON'].model).toBe('my_model');

    rmSync(dir, { recursive: true });
  });

  it('ignores models entries without filename field', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      models: {
        HERO: 'some_string_value',
        valid_model: { filename: 'test.safetensors', type: 'checkpoint' },
      },
    }));

    const cfg = loadConfig({}, configFile);
    expect(cfg.models['HERO']).toBeUndefined();
    expect(cfg.models['valid_model']).toBeDefined();

    rmSync(dir, { recursive: true });
  });

  it('falls back to defaults on malformed JSON and logs to stderr', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, 'this is not valid json {{{');

    const cfg = loadConfig({}, configFile);
    expect(cfg.serverUrl).toBe(DEFAULT_SERVER_URL);
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0][0]).toContain('claude-imagine: config parse error');

    stderrSpy.mockRestore();
    rmSync(dir, { recursive: true });
  });

  it('reads width and height overrides from imageTypes', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      models: {
        test_model: { filename: 'test.safetensors', type: 'checkpoint' },
      },
      imageTypes: {
        ICON: { model: 'test_model', width: 256, height: 256 },
        HERO: { model: 'test_model' },
      },
    }));

    const cfg = loadConfig({}, configFile);
    expect(cfg.imageTypes['ICON'].width).toBe(256);
    expect(cfg.imageTypes['ICON'].height).toBe(256);
    expect(cfg.imageTypes['HERO'].width).toBeUndefined();
    expect(cfg.imageTypes['HERO'].height).toBeUndefined();

    rmSync(dir, { recursive: true });
  });

  it('ignores non-numeric width/height in imageTypes', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      models: {
        test_model: { filename: 'test.safetensors', type: 'checkpoint' },
      },
      imageTypes: {
        ICON: { model: 'test_model', width: 'big', height: true },
      },
    }));

    const cfg = loadConfig({}, configFile);
    expect(cfg.imageTypes['ICON'].width).toBeUndefined();
    expect(cfg.imageTypes['ICON'].height).toBeUndefined();

    rmSync(dir, { recursive: true });
  });

  it('handles empty config file without error', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, '{}');

    const cfg = loadConfig({}, configFile);
    expect(cfg.serverUrl).toBe(DEFAULT_SERVER_URL);
    expect(Object.keys(cfg.models).length).toBe(0);

    rmSync(dir, { recursive: true });
  });
});
