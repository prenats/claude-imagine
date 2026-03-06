/**
 * Locate bundled asset files (skills, commands, rules) in the npm package.
 *
 * When installed via npm, assets live relative to the package root.
 * When running from a git clone, they're in the repo root.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Root of the npm package (parent of dist/). */
export const PACKAGE_ROOT = join(__dirname, '..');

/** All asset files to copy into the target .claude/ directory. */
export const ASSET_FILES = [
  { src: 'skills/claude-imagine/image-generate/SKILL.md', dest: 'skills/claude-imagine/image-generate/SKILL.md' },
  { src: 'skills/claude-imagine/image-suggest/SKILL.md', dest: 'skills/claude-imagine/image-suggest/SKILL.md' },
  { src: 'commands/claude-imagine/image-generate.md', dest: 'commands/claude-imagine/image-generate.md' },
  { src: 'commands/claude-imagine/image-suggest.md', dest: 'commands/claude-imagine/image-suggest.md' },
  { src: 'rules/image/image-generation.md', dest: 'rules/image/image-generation.md' },
] as const;

/** Resolve the absolute path of a bundled asset. */
export function resolveAsset(relativePath: string): string {
  return join(PACKAGE_ROOT, relativePath);
}
