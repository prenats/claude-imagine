#!/usr/bin/env node
/**
 * CLI dispatcher for claude-imagine.
 *
 * - No args / "setup"   → interactive setup (installer)
 * - --server             → start MCP server (stdio)
 * - uninstall            → remove installed files
 * - check                → verify installation
 * - --version            → print version
 * - --help               → print help
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const version: string = pkg.version;

const args = process.argv.slice(2);
const command = args[0] ?? '';

if (args.includes('--server')) {
  await import('./index.js');
} else if (args.includes('--version') || args.includes('-V')) {
  console.log(version);
} else if (args.includes('--help') || args.includes('-h')) {
  printHelp();
} else if (command === 'uninstall') {
  await import('./uninstall-cli.js');
} else if (command === 'check') {
  await import('./check-cli.js');
} else if (command === '' || command === 'setup') {
  await import('./setup-cli.js');
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

function printHelp(): void {
  console.log(`
  claude-imagine v${version}
  AI image generation for Claude Code

  Usage: claude-imagine [command] [options]

  Commands:
    (no args)      Interactive setup (first-time install)
    setup          Same as no args — run interactive setup
    uninstall      Remove skills, commands, rules and MCP registration
    check          Verify an existing installation

  Options:
    --server       Start MCP server on stdio (used by Claude Code)
    --version, -V  Print version
    --help, -h     Print this help
`);
}
