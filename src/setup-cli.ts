#!/usr/bin/env node
/**
 * Interactive setup CLI for claude-imagine.
 * Equivalent to install.sh but runs via `npx claude-imagine@latest`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

import {
  colors, step, warn, fail, header, detail, printLine,
  printBanner, getVersion, prompt, promptChoice, promptNumberedList,
} from './cli-ui.js';
import { ASSET_FILES, resolveAsset } from './asset-resolver.js';
import { detectAndDiscover, isSetupError, buildConfig } from './setup-core.js';
import { suggestTier } from './backends/comfyui/defaults.js';
import type { QualityTier } from './setup-core.js';

const version = getVersion();

async function main(): Promise<void> {
  printBanner(version);

  // --- Scope selection ---
  const { scope, claudeDir, projectDir } = await chooseScope('Install');

  // --- Prerequisites ---
  header('Prerequisites');
  checkPrereqs(claudeDir, scope);

  // --- Copy assets ---
  header('Claude Code Integration');
  copyAssets(claudeDir);

  // --- Server config ---
  const serverUrl = await configureServer();

  // --- Backend detection ---
  header('Backend Detection');
  const configDir = join(homedir(), '.config', 'claude-imagine');
  mkdirSync(configDir, { recursive: true });

  const result = await detectAndDiscover(serverUrl);

  if (isSetupError(result)) {
    warn(`Auto-detection failed: ${result.error}`);
    detail('The server may not be a supported backend (ComfyUI, A1111)');
    detail('Re-run setup once your server is running');
  } else {
    step(`Backend: ${colors.bold}${result.backend}${colors.reset}`);

    if (result.models.length > 0) {
      console.log('');
      header(`Discovered Models (${result.models.length})`);
      console.log('');
      console.log(`    ${colors.bold}Type          Model${colors.reset}`);
      printLine();

      for (const m of result.models) {
        const typeColor = m.type === 'checkpoint' ? colors.yellow
          : m.type === 'unet' ? colors.blue : colors.reset;
        const name = m.displayName.length > 34
          ? m.displayName.slice(0, 31) + '...'
          : m.displayName;
        console.log(`    ${typeColor}${m.type.padEnd(13)}${colors.reset} ${name}`);
      }

      // --- Quality tier assignment ---
      const tierMap = await assignTiers(result.models);

      // --- CLIP/VAE configuration for UNET models ---
      const config = buildConfig(result.backend, serverUrl, result.models, tierMap);
      const unetModels = result.models.filter(m => m.type === 'unet');
      if (unetModels.length > 0 && (result.supportFiles.clipFiles.length > 0 || result.supportFiles.vaeFiles.length > 0)) {
        await configureUnetSupportFiles(unetModels, result.supportFiles, config);
      }

      console.log('');
      writeFileSync(
        join(configDir, 'config.json'),
        JSON.stringify(config, null, 2) + '\n',
      );
      step(`Config saved (${configDir}/config.json)`);
    } else {
      warn('No models found on server');
    }
  }

  // --- Register MCP server ---
  registerMcp(scope, projectDir);

  // --- Done ---
  console.log('');
  printLine();
  console.log('');
  console.log(`  ${colors.green}${colors.bold}Installation complete${colors.reset}`);
  console.log('');
  console.log(`  ${colors.bold}Next steps:${colors.reset}`);
  console.log('');
  console.log('    Restart Claude Code, then generate images:');
  console.log(`       ${colors.cyan}/claude-imagine:image-generate${colors.reset}`);
  console.log(`       ${colors.cyan}/claude-imagine:image-suggest${colors.reset}`);
  console.log('');
  console.log(`  ${colors.dim}Config: ${configDir}/config.json${colors.reset}`);
  console.log(`  ${colors.dim}Edit config to customize model assignments or add models${colors.reset}`);
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────

interface ScopeChoice {
  readonly scope: 'global' | 'local';
  readonly claudeDir: string;
  readonly projectDir: string;
}

async function chooseScope(verb: string): Promise<ScopeChoice> {
  header(`${verb} scope`);
  console.log('');
  console.log(`    ${colors.cyan}1${colors.reset}  Global  ${colors.dim}~/.claude/ (available in all projects)${colors.reset}`);
  console.log(`    ${colors.cyan}2${colors.reset}  Local   ${colors.dim}current project directory${colors.reset}`);
  console.log('');

  const choice = await promptChoice('Choose [1/2]: ', ['1', '2']);

  if (choice === '1') {
    return {
      scope: 'global',
      claudeDir: join(homedir(), '.claude'),
      projectDir: '',
    };
  }

  const cwd = process.cwd();
  console.log(`    ${colors.dim}Project: ${cwd}${colors.reset}`);

  return {
    scope: 'local',
    claudeDir: join(cwd, '.claude'),
    projectDir: cwd,
  };
}

function checkPrereqs(claudeDir: string, scope: string): void {
  if (process.getuid?.() === 0) {
    console.error('  Do not run as root.');
    process.exit(1);
  }

  if (scope === 'global' && !existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1), 10);
  if (nodeMajor < 20) {
    fail(`Node.js ${nodeVersion} found, need 20+`);
    process.exit(1);
  }
  step(`Node.js ${nodeVersion}`);

  // claude CLI
  try {
    execSync('claude --version', { stdio: 'pipe' });
    step('Claude Code CLI');
  } catch {
    warn('Claude Code CLI not found (MCP registration will need manual setup)');
  }
}

function copyFile(src: string, dst: string): void {
  if (!existsSync(src)) {
    fail(`Source file not found: ${src}`);
    return;
  }

  mkdirSync(dirname(dst), { recursive: true });

  if (existsSync(dst)) {
    const srcContent = readFileSync(src);
    const dstContent = readFileSync(dst);
    if (srcContent.equals(dstContent)) return;
    copyFileSync(dst, dst + '.bak');
  }

  copyFileSync(src, dst);
}

function copyAssets(claudeDir: string): void {
  for (const asset of ASSET_FILES) {
    const src = resolveAsset(asset.src);
    const dst = join(claudeDir, asset.dest);
    copyFile(src, dst);
  }
  step('Skills installed');
  step('Commands installed');
  step('Rules installed');
}

async function configureServer(): Promise<string> {
  const configDir = join(homedir(), '.config', 'claude-imagine');
  const configPath = join(configDir, 'config.json');
  const defaultUrl = 'http://localhost:8188';

  let currentUrl = '';
  if (existsSync(configPath)) {
    try {
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      currentUrl = data?.server?.url ?? data?.serverUrl ?? '';
    } catch { /* ignore */ }
  }

  const promptDefault = currentUrl || defaultUrl;

  header('Server Configuration');
  console.log('');

  let serverUrl = '';
  while (true) {
    serverUrl = await prompt('Server URL', promptDefault);

    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      serverUrl = 'http://' + serverUrl;
    }

    process.stdout.write(`  Connecting to ${colors.cyan}${serverUrl}${colors.reset} ... `);

    const reachable = await checkServerReachable(serverUrl);
    if (reachable) {
      console.log(`${colors.green}OK${colors.reset}`);
      break;
    }

    console.log(`${colors.red}unreachable${colors.reset}`);
    const answer = await prompt('Use this URL anyway? [y/N]', 'N');
    if (answer.toLowerCase().startsWith('y')) break;
    console.log('');
  }

  return serverUrl;
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

function registerMcp(scope: 'global' | 'local', projectDir: string): void {
  const mcpScope = scope === 'global' ? 'user' : 'project';

  try {
    execSync('claude --version', { stdio: 'pipe' });
  } catch {
    warn(`Claude Code CLI not found — register manually: claude mcp add -s ${mcpScope} claude-imagine -- npx -y claude-imagine --server`);
    return;
  }

  try {
    const cwd = scope === 'local' && projectDir ? projectDir : undefined;
    const opts = { stdio: 'pipe' as const, cwd };

    try {
      execSync(`claude mcp remove claude-imagine -s ${mcpScope}`, opts);
    } catch { /* may not exist yet */ }

    execSync(`claude mcp add -s ${mcpScope} claude-imagine -- npx -y claude-imagine --server`, opts);
    step(`MCP server registered with Claude Code (${mcpScope})`);
  } catch {
    warn(`Could not register MCP server (try: claude mcp add -s ${mcpScope} claude-imagine -- npx -y claude-imagine --server)`);
  }
}

async function assignTiers(
  models: ReadonlyArray<import('./backends/types.js').DiscoveredModel>,
): Promise<Record<string, QualityTier>> {
  console.log('');
  header('Quality Tier Assignment');
  console.log('');
  detail('Assign each model a quality tier. This determines which image types use it.');
  detail('  fast     = ICON, THUMBNAIL, BACKGROUND, TEXTURE');
  detail('  standard = AVATAR, CONTENT, BANNER, PRODUCT');
  detail('  high     = LOGO, HERO, FEATURED');
  console.log('');

  const tierMap: Record<string, QualityTier> = {};
  const tierChoices = ['fast', 'standard', 'high'] as const;

  for (const m of models) {
    const suggested = suggestTier(m.filename, m.type);
    const label = `${colors.bold}${m.displayName}${colors.reset} [${suggested}]`;
    const answer = await promptChoice(
      `  ${label}: `,
      [...tierChoices, ''],
    );
    tierMap[m.id] = (answer === '' ? suggested : answer) as QualityTier;
    step(`${m.displayName} -> ${tierMap[m.id]}`);
  }

  return tierMap;
}

async function configureUnetSupportFiles(
  unetModels: ReadonlyArray<import('./backends/types.js').DiscoveredModel>,
  supportFiles: import('./setup-core.js').SetupResult['supportFiles'],
  config: Record<string, unknown>,
): Promise<void> {
  console.log('');
  header('CLIP & VAE Configuration');
  console.log('');
  detail('UNET models (e.g. Flux) require separate CLIP and VAE files.');
  detail('Select the files that match each model. Press Enter for the default.');
  console.log('');

  const modelsConfig = config['models'] as Record<string, Record<string, unknown>>;

  // Find sensible defaults using filename heuristics
  const defaultClip1 = findBestMatch(supportFiles.clipFiles, ['clip_l']);
  const defaultClip2 = findBestMatch(supportFiles.clipFiles, ['t5xxl', 't5_xxl']);
  const defaultVae = findBestMatch(supportFiles.vaeFiles, ['ae', 'flux_vae']);

  // If all UNETs will likely use the same CLIP/VAE, ask once
  const askOnce = unetModels.length > 1;
  if (askOnce) {
    detail(`Applying the same CLIP/VAE to all ${unetModels.length} UNET models.`);
    detail('Edit config.json later to customize per model.');
    console.log('');
  }

  // Select CLIP 1
  let clip1: string | undefined;
  if (supportFiles.clipFiles.length > 0) {
    console.log(`  ${colors.bold}CLIP model 1${colors.reset} ${colors.dim}(e.g. clip_l for Flux)${colors.reset}`);
    const idx = await promptNumberedList(
      'Select',
      [...supportFiles.clipFiles],
      defaultClip1,
    );
    clip1 = supportFiles.clipFiles[idx];
    step(`CLIP 1: ${clip1}`);
  }

  // Select CLIP 2 (exclude already-selected CLIP 1)
  let clip2: string | undefined;
  const clip2Candidates = supportFiles.clipFiles.filter(f => f !== clip1);
  if (clip2Candidates.length > 0) {
    console.log('');
    console.log(`  ${colors.bold}CLIP model 2${colors.reset} ${colors.dim}(e.g. t5xxl for Flux)${colors.reset}`);
    const defaultClip2Adjusted = defaultClip2 !== undefined
      ? clip2Candidates.indexOf(supportFiles.clipFiles[defaultClip2])
      : undefined;
    const defaultClip2Final = defaultClip2Adjusted !== undefined && defaultClip2Adjusted >= 0
      ? defaultClip2Adjusted
      : undefined;
    const idx = await promptNumberedList(
      'Select',
      [...clip2Candidates],
      defaultClip2Final,
    );
    clip2 = clip2Candidates[idx];
    step(`CLIP 2: ${clip2}`);
  }

  // Select VAE
  let vae: string | undefined;
  if (supportFiles.vaeFiles.length > 0) {
    console.log('');
    console.log(`  ${colors.bold}VAE model${colors.reset} ${colors.dim}(e.g. ae for Flux)${colors.reset}`);
    const idx = await promptNumberedList(
      'Select',
      [...supportFiles.vaeFiles],
      defaultVae,
    );
    vae = supportFiles.vaeFiles[idx];
    step(`VAE: ${vae}`);
  }

  // Write selections into model params
  for (const model of unetModels) {
    const modelConfig = modelsConfig[model.id];
    if (!modelConfig) continue;

    const params = { ...(modelConfig['params'] as Record<string, unknown> ?? {}) };
    if (clip1) params['clip_name1'] = clip1;
    if (clip2) params['clip_name2'] = clip2;
    if (vae) params['vae_name'] = vae;
    modelConfig['params'] = params;
  }
}

function findBestMatch(files: ReadonlyArray<string>, patterns: string[]): number | undefined {
  for (const pattern of patterns) {
    const idx = files.findIndex(f => f.toLowerCase().includes(pattern.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return files.length > 0 ? 0 : undefined;
}

main().catch((e) => {
  console.error(`\n  ${colors.red}Error:${colors.reset} ${e}`);
  process.exit(1);
});
