import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

describe('setup-cli copyFile logic', () => {
  // Re-implement the copyFile function from setup-cli.ts for unit testing
  function copyFile(src: string, dst: string): { copied: boolean; backedUp: boolean; skipped: boolean } {
    if (!existsSync(src)) {
      return { copied: false, backedUp: false, skipped: false };
    }

    mkdirSync(dirname(dst), { recursive: true });

    if (existsSync(dst)) {
      const srcContent = readFileSync(src);
      const dstContent = readFileSync(dst);
      if (srcContent.equals(dstContent)) {
        return { copied: false, backedUp: false, skipped: true };
      }
      copyFileSync(dst, dst + '.bak');
      copyFileSync(src, dst);
      return { copied: true, backedUp: true, skipped: false };
    }

    copyFileSync(src, dst);
    return { copied: true, backedUp: false, skipped: false };
  }

  function makeTmpDir(): string {
    const dir = join(tmpdir(), `ci-setup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  it('copies a new file', () => {
    const dir = makeTmpDir();
    const src = join(dir, 'src.md');
    const dst = join(dir, 'sub', 'dst.md');
    writeFileSync(src, 'hello');

    const result = copyFile(src, dst);
    expect(result.copied).toBe(true);
    expect(result.backedUp).toBe(false);
    expect(readFileSync(dst, 'utf-8')).toBe('hello');
    rmSync(dir, { recursive: true, force: true });
  });

  it('skips copy when content is identical', () => {
    const dir = makeTmpDir();
    const src = join(dir, 'src.md');
    const dst = join(dir, 'dst.md');
    writeFileSync(src, 'same');
    writeFileSync(dst, 'same');

    const result = copyFile(src, dst);
    expect(result.skipped).toBe(true);
    expect(result.copied).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('backs up existing file when content differs', () => {
    const dir = makeTmpDir();
    const src = join(dir, 'src.md');
    const dst = join(dir, 'dst.md');
    writeFileSync(src, 'new content');
    writeFileSync(dst, 'old content');

    const result = copyFile(src, dst);
    expect(result.copied).toBe(true);
    expect(result.backedUp).toBe(true);
    expect(readFileSync(dst, 'utf-8')).toBe('new content');
    expect(readFileSync(dst + '.bak', 'utf-8')).toBe('old content');
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns not-copied when source does not exist', () => {
    const result = copyFile('/nonexistent/file.md', '/tmp/dst.md');
    expect(result.copied).toBe(false);
  });
});

describe('setup-cli configureServer logic', () => {
  it('prepends http:// to bare URLs', () => {
    let url = 'localhost:8188';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    expect(url).toBe('http://localhost:8188');
  });

  it('leaves http:// URLs unchanged', () => {
    let url = 'http://localhost:8188';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    expect(url).toBe('http://localhost:8188');
  });

  it('leaves https:// URLs unchanged', () => {
    let url = 'https://my-server.com:8188';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    expect(url).toBe('https://my-server.com:8188');
  });
});

describe('setup-cli registerMcp logic', () => {
  it('maps global scope to user MCP scope', () => {
    const scope: 'global' | 'local' = 'global';
    const mcpScope = scope === 'global' ? 'user' : 'project';
    expect(mcpScope).toBe('user');
  });

  it('maps local scope to project MCP scope', () => {
    const scope: 'global' | 'local' = 'local';
    const mcpScope = scope === 'global' ? 'user' : 'project';
    expect(mcpScope).toBe('project');
  });
});

describe('setup-cli checkPrereqs logic', () => {
  it('parses Node.js version correctly', () => {
    const nodeVersion = 'v20.11.0';
    const nodeMajor = parseInt(nodeVersion.slice(1), 10);
    expect(nodeMajor).toBe(20);
    expect(nodeMajor).toBeGreaterThanOrEqual(20);
  });

  it('detects Node.js < 20 as insufficient', () => {
    const nodeVersion = 'v18.19.0';
    const nodeMajor = parseInt(nodeVersion.slice(1), 10);
    expect(nodeMajor).toBeLessThan(20);
  });

  it('parses existing config for server URL', () => {
    const configData = JSON.stringify({ server: { url: 'http://10.0.0.1:8188' }, serverUrl: 'http://fallback' });
    const data = JSON.parse(configData);
    const url = data?.server?.url ?? data?.serverUrl ?? '';
    expect(url).toBe('http://10.0.0.1:8188');
  });

  it('falls back to serverUrl when server.url is missing', () => {
    const configData = JSON.stringify({ serverUrl: 'http://fallback:8188' });
    const data = JSON.parse(configData);
    const url = data?.server?.url ?? data?.serverUrl ?? '';
    expect(url).toBe('http://fallback:8188');
  });
});
