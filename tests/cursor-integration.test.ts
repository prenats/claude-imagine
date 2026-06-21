import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  writeCursorMcpJson,
  installCursorRule,
  installCursorIntegration,
  hasCursorMcpRegistration,
  hasCursorRule,
  cursorMcpPath,
} from '../src/cursor-integration.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `claude-imagine-cursor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('cursor-integration', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes MCP config and merges with existing servers', () => {
    const projectDir = makeTmpDir();
    dirs.push(projectDir);
    const cursorDir = join(projectDir, '.cursor');
    mkdirSync(cursorDir, { recursive: true });
    writeFileSync(join(cursorDir, 'mcp.json'), JSON.stringify({
      mcpServers: { other: { command: 'echo', args: [] } },
    }));

    const mcpPath = writeCursorMcpJson('local', projectDir, {
      serverUrl: 'https://bared.example/comfy',
      serverToken: 'tok',
      tlsInsecure: true,
      configPath: '/tmp/config.json',
    });

    const data = JSON.parse(readFileSync(mcpPath, 'utf-8')) as {
      mcpServers: Record<string, { env?: Record<string, string> }>;
    };
    expect(data.mcpServers['other']).toBeDefined();
    expect(data.mcpServers['claude-imagine']?.env?.['IMAGINE_SERVER_URL']).toBe('https://bared.example/comfy');
    expect(data.mcpServers['claude-imagine']?.env?.['IMAGINE_SERVER_TOKEN']).toBe('tok');
    expect(data.mcpServers['claude-imagine']?.env?.['IMAGINE_TLS_INSECURE']).toBe('1');
    expect(data.mcpServers['claude-imagine']?.env?.['IMAGINE_CONFIG']).toBe('/tmp/config.json');
  });

  it('installs cursor rule and reports registration status', () => {
    const projectDir = makeTmpDir();
    dirs.push(projectDir);

    const result = installCursorIntegration('local', projectDir, {
      serverUrl: 'http://localhost:8188',
    });

    expect(existsSync(result.mcpPath)).toBe(true);
    expect(existsSync(result.rulePath)).toBe(true);
    expect(hasCursorMcpRegistration('local', projectDir)).toBe(true);
    expect(hasCursorRule('local', projectDir)).toBe(true);
    expect(cursorMcpPath('local', projectDir)).toBe(join(projectDir, '.cursor', 'mcp.json'));
  });

  it('returns false when MCP file is missing or invalid', () => {
    const projectDir = makeTmpDir();
    dirs.push(projectDir);
    expect(hasCursorMcpRegistration('local', projectDir)).toBe(false);

    const cursorDir = join(projectDir, '.cursor');
    mkdirSync(cursorDir, { recursive: true });
    writeFileSync(join(cursorDir, 'mcp.json'), 'not-json');
    expect(hasCursorMcpRegistration('local', projectDir)).toBe(false);
  });

  it('installCursorRule copies rule file to destination', () => {
    const projectDir = makeTmpDir();
    dirs.push(projectDir);
    const rulePath = installCursorRule('local', projectDir);
    expect(existsSync(rulePath)).toBe(true);
    expect(readFileSync(rulePath, 'utf-8')).toContain('generate_image');
  });
});
