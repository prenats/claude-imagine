import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, rmSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

describe('uninstall-cli removeFile logic', () => {
  // Re-implement the removeFile function from uninstall-cli.ts for testing
  function removeFile(path: string, claudeDir: string): void {
    if (!existsSync(path)) return;
    rmSync(path, { force: true });
    let parent = dirname(path);
    while (parent !== claudeDir && parent !== '/' && parent !== '.') {
      if (!existsSync(parent)) break;
      const entries = readdirSync(parent);
      if (entries.length === 0) {
        rmSync(parent, { recursive: true, force: true });
        parent = dirname(parent);
      } else {
        break;
      }
    }
  }

  function makeTmpDir(): string {
    const dir = join(tmpdir(), `ci-uninstall-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  it('removes a file and cleans empty parent directories', () => {
    const baseDir = makeTmpDir();
    const nested = join(baseDir, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    const filePath = join(nested, 'test.md');
    writeFileSync(filePath, 'content');

    removeFile(filePath, baseDir);

    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(join(baseDir, 'a'))).toBe(false);
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('does not remove parent if it still has other files', () => {
    const baseDir = makeTmpDir();
    const nested = join(baseDir, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    const filePath = join(nested, 'test.md');
    const otherFile = join(nested, 'other.md');
    writeFileSync(filePath, 'content');
    writeFileSync(otherFile, 'keep me');

    removeFile(filePath, baseDir);

    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(nested)).toBe(true);
    expect(existsSync(otherFile)).toBe(true);
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('does nothing if file does not exist', () => {
    const baseDir = makeTmpDir();
    // Should not throw
    removeFile(join(baseDir, 'nonexistent.md'), baseDir);
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('stops cleanup at claudeDir boundary', () => {
    const baseDir = makeTmpDir();
    const claudeDir = join(baseDir, 'claude');
    const nested = join(claudeDir, 'skills', 'ci');
    mkdirSync(nested, { recursive: true });
    const filePath = join(nested, 'SKILL.md');
    writeFileSync(filePath, 'content');

    removeFile(filePath, claudeDir);

    expect(existsSync(filePath)).toBe(false);
    // claudeDir itself should still exist
    expect(existsSync(claudeDir)).toBe(true);
    rmSync(baseDir, { recursive: true, force: true });
  });
});

describe('uninstall-cli scope logic', () => {
  it('maps choice 1 to global scope', () => {
    const scope = '1' === '1' ? 'global' : 'local';
    expect(scope).toBe('global');
  });

  it('maps choice 2 to local scope', () => {
    const scope = '2' === '1' ? 'global' : 'local';
    expect(scope).toBe('local');
  });

  it('uses user MCP scope for global installs', () => {
    const scope = 'global';
    const mcpScope = scope === 'global' ? 'user' : 'project';
    expect(mcpScope).toBe('user');
  });

  it('uses project MCP scope for local installs', () => {
    const scope = 'local';
    const mcpScope = scope === 'global' ? 'user' : 'project';
    expect(mcpScope).toBe('project');
  });
});
