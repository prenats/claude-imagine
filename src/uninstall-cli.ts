#!/usr/bin/env node
/**
 * Uninstall CLI for claude-imagine.
 * Removes skills, commands, rules, and MCP registration.
 */

import { existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

import {
  colors, step, warn, header, printLine, printBanner, getVersion, promptChoice,
} from './cli-ui.js';
import { ASSET_FILES } from './asset-resolver.js';

const version = getVersion();

async function main(): Promise<void> {
  printBanner(version);

  // --- Scope selection ---
  header('Uninstall scope');
  console.log('');
  console.log(`    ${colors.cyan}1${colors.reset}  Global  ${colors.dim}~/.claude/${colors.reset}`);
  console.log(`    ${colors.cyan}2${colors.reset}  Local   ${colors.dim}current project directory${colors.reset}`);
  console.log('');

  const choice = await promptChoice('Choose [1/2]: ', ['1', '2']);
  const scope = choice === '1' ? 'global' : 'local';
  const claudeDir = choice === '1'
    ? join(homedir(), '.claude')
    : join(process.cwd(), '.claude');
  const projectDir = choice === '2' ? process.cwd() : '';

  header('Removing components');

  // Remove asset files
  for (const asset of ASSET_FILES) {
    const path = join(claudeDir, asset.dest);
    removeFile(path, claudeDir);
  }
  step('Skills removed');
  step('Commands removed');
  step('Rules removed');

  // Deregister MCP
  const mcpScope = scope === 'global' ? 'user' : 'project';
  try {
    execSync('claude --version', { stdio: 'pipe' });
    const cwd = scope === 'local' && projectDir ? projectDir : undefined;
    execSync(`claude mcp remove claude-imagine -s ${mcpScope}`, { stdio: 'pipe', cwd });
    step(`MCP server deregistered from Claude Code (${mcpScope})`);
  } catch {
    warn(`Could not deregister MCP server (try: claude mcp remove claude-imagine -s ${mcpScope})`);
  }

  // Config
  const configDir = join(homedir(), '.config', 'claude-imagine');
  if (existsSync(join(configDir, 'config.json'))) {
    warn(`Config preserved: ${configDir}/ (delete manually if unneeded)`);
  }

  console.log('');
  printLine();
  console.log('');
  console.log(`  ${colors.bold}Uninstall complete.${colors.reset}`);
  console.log('');
}

function removeFile(path: string, claudeDir: string): void {
  if (!existsSync(path)) return;

  rmSync(path, { force: true });

  // Clean up empty parent directories up to claudeDir
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

main().catch((e) => {
  console.error(`\n  ${colors.red}Error:${colors.reset} ${e}`);
  process.exit(1);
});
