#!/usr/bin/env node
/**
 * Installation check CLI for claude-imagine.
 * Verifies that all components are installed correctly.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import {
  colors, step, warn, fail, header, detail, printLine, printBanner, getVersion,
} from './cli-ui.js';
import { ASSET_FILES } from './asset-resolver.js';

const version = getVersion();

async function main(): Promise<void> {
  printBanner(version);

  header('Installation Status');
  let errors = 0;
  let warnings = 0;

  // Check global installation
  const globalClaudeDir = join(homedir(), '.claude');
  const localClaudeDir = join(process.cwd(), '.claude');

  // Determine which installation exists
  const hasGlobal = ASSET_FILES.some(a => existsSync(join(globalClaudeDir, a.dest)));
  const hasLocal = ASSET_FILES.some(a => existsSync(join(localClaudeDir, a.dest)));

  if (hasGlobal) {
    step(`Global installation detected (${globalClaudeDir})`);
    const result = checkAssets(globalClaudeDir);
    errors += result.errors;
  }

  if (hasLocal) {
    step(`Local installation detected (${localClaudeDir})`);
    const result = checkAssets(localClaudeDir);
    errors += result.errors;
  }

  if (!hasGlobal && !hasLocal) {
    fail('No installation found (global or local)');
    errors++;
  }

  // Config
  const configDir = join(homedir(), '.config', 'claude-imagine');
  const configPath = join(configDir, 'config.json');

  if (existsSync(configPath)) {
    step(`Config: ${configPath}`);
    try {
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      const backend = data?.backend ?? 'unknown';
      const modelCount = data?.models ? Object.keys(data.models).length : 0;
      detail(`Backend: ${backend}, Models: ${modelCount}`);
    } catch {
      warn('Config file exists but could not be parsed');
      warnings++;
    }
  } else {
    warn('Config: not found (using defaults)');
    warnings++;
  }

  // Server connectivity
  header('Server');
  let serverUrl = 'http://localhost:8188';
  if (existsSync(configPath)) {
    try {
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      serverUrl = data?.server?.url ?? data?.serverUrl ?? serverUrl;
    } catch { /* use default */ }
  }

  process.stdout.write(`  Connecting to ${colors.cyan}${serverUrl}${colors.reset} ... `);
  const reachable = await checkServerReachable(serverUrl);
  if (reachable) {
    console.log(`${colors.green}OK${colors.reset}`);
  } else {
    console.log(`${colors.red}unreachable${colors.reset}`);
    warnings++;
  }

  console.log('');
  printLine();
  console.log('');

  if (errors === 0 && warnings === 0) {
    console.log(`  ${colors.green}All checks passed.${colors.reset}`);
  } else if (errors === 0) {
    console.log(`  ${colors.green}OK${colors.reset} with ${warnings} warning(s).`);
  } else {
    console.log(`  ${colors.red}${errors} issue(s) found.${colors.reset} Run: npx claude-imagine@latest`);
  }
  console.log('');

  process.exit(errors > 0 ? 1 : 0);
}

function checkAssets(claudeDir: string): { errors: number } {
  let errors = 0;

  // Skills
  for (const skill of ['image-generate', 'image-suggest']) {
    const path = join(claudeDir, 'skills', 'claude-imagine', skill, 'SKILL.md');
    if (existsSync(path)) {
      step(`Skill: ${skill}`);
    } else {
      fail(`Skill: ${skill} missing`);
      errors++;
    }
  }

  // Commands
  for (const cmd of ['image-generate', 'image-suggest']) {
    const path = join(claudeDir, 'commands', 'claude-imagine', `${cmd}.md`);
    if (existsSync(path)) {
      step(`Command: /claude-imagine:${cmd}`);
    } else {
      fail(`Command: /claude-imagine:${cmd} missing`);
      errors++;
    }
  }

  // Rule
  const rulePath = join(claudeDir, 'rules', 'image', 'image-generation.md');
  if (existsSync(rulePath)) {
    step('Rule: image-generation');
  } else {
    fail('Rule: image-generation missing');
    errors++;
  }

  return { errors };
}

async function checkServerReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

main().catch((e) => {
  console.error(`\n  ${colors.red}Error:${colors.reset} ${e}`);
  process.exit(1);
});
