import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../src/config.js';
import {
  buildAuthHeaders,
  configureServerTransport,
  resetServerTransportForTests,
} from '../src/server-transport.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `claude-imagine-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Server auth config', () => {
  it('reads server.token and tlsInsecure from config file', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      server: {
        url: 'https://bared.example/comfy',
        token: 'secret-token',
        tlsInsecure: true,
      },
    }));

    const cfg = loadConfig({}, configFile);
    expect(cfg.serverUrl).toBe('https://bared.example/comfy');
    expect(cfg.serverToken).toBe('secret-token');
    expect(cfg.tlsInsecure).toBe(true);

    rmSync(dir, { recursive: true });
  });

  it('IMAGINE_SERVER_TOKEN overrides config file token', () => {
    const dir = makeTmpDir();
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({ server: { url: 'http://x', token: 'file' } }));

    const cfg = loadConfig({ IMAGINE_SERVER_TOKEN: 'env-token' }, configFile);
    expect(cfg.serverToken).toBe('env-token');

    rmSync(dir, { recursive: true });
  });
});

describe('Server transport', () => {
  afterEach(() => {
    resetServerTransportForTests();
  });

  it('adds Authorization header when token is configured', () => {
    configureServerTransport({ token: 'abc123' });
    const headers = buildAuthHeaders();
    expect(headers.get('Authorization')).toBe('Bearer abc123');
  });

  it('omits Authorization when no token', () => {
    configureServerTransport({});
    const headers = buildAuthHeaders();
    expect(headers.get('Authorization')).toBeNull();
  });
});
