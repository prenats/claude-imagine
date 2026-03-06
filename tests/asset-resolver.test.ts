import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { PACKAGE_ROOT, ASSET_FILES, resolveAsset } from '../src/asset-resolver.js';

describe('asset-resolver', () => {
  describe('PACKAGE_ROOT', () => {
    it('points to the repo root (parent of dist/)', () => {
      // PACKAGE_ROOT is join(__dirname, '..') where __dirname is src/
      expect(PACKAGE_ROOT).toMatch(/claude-imagine$/);
    });
  });

  describe('ASSET_FILES', () => {
    it('contains expected skill files', () => {
      const srcs = ASSET_FILES.map(a => a.src);
      expect(srcs).toContain('skills/claude-imagine/image-generate/SKILL.md');
      expect(srcs).toContain('skills/claude-imagine/image-suggest/SKILL.md');
    });

    it('contains expected command files', () => {
      const srcs = ASSET_FILES.map(a => a.src);
      expect(srcs).toContain('commands/claude-imagine/image-generate.md');
      expect(srcs).toContain('commands/claude-imagine/image-suggest.md');
    });

    it('contains the rule file', () => {
      const srcs = ASSET_FILES.map(a => a.src);
      expect(srcs).toContain('rules/image/image-generation.md');
    });

    it('has matching src and dest paths', () => {
      for (const asset of ASSET_FILES) {
        expect(asset.src).toBe(asset.dest);
      }
    });

    it('has exactly 5 asset entries', () => {
      expect(ASSET_FILES).toHaveLength(5);
    });
  });

  describe('resolveAsset', () => {
    it('returns an absolute path under PACKAGE_ROOT', () => {
      const result = resolveAsset('skills/claude-imagine/image-generate/SKILL.md');
      expect(result).toBe(join(PACKAGE_ROOT, 'skills/claude-imagine/image-generate/SKILL.md'));
    });

    it('works with any relative path', () => {
      const result = resolveAsset('foo/bar.txt');
      expect(result).toBe(join(PACKAGE_ROOT, 'foo/bar.txt'));
    });
  });
});
