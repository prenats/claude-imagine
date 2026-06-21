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
import {
  DEFAULT_BARED_COMFY_URL,
  installCursorIntegration,
  type CursorScope,
} from './cursor-integration.js';
import { verifyServerConnection, applyServerConnectionOptions } from './server-check.js';

const version = getVersion();

type IdeTarget = 'claude' | 'cursor' | 'both';

async function main(): Promise<void> {
  printBanner(version);

  const ide = await chooseIdeTarget();

  // --- Scope selection ---
  const { scope, claudeDir, projectDir } = await chooseScope('Install');

  // --- Prerequisites ---
  header('Prerequisites');
  if (ide === 'claude' || ide === 'both') {
    checkPrereqs(claudeDir, scope);
  }

  // --- Copy Claude Code assets ---
  if (ide === 'claude' || ide === 'both') {
    header('Claude Code Integration');
    copyAssets(claudeDir);
  }

  // --- Server config ---
  const server = await configureServer();

  // --- Backend detection ---
  header('Backend Detection');
  const configDir = join(homedir(), '.config', 'claude-imagine');
  mkdirSync(configDir, { recursive: true });
  const configPath = join(configDir, 'config.json');

  applyServerConnectionOptions({
    token: server.token,
    tlsInsecure: server.tlsInsecure,
  });

  const result = await detectAndDiscover(server.url);

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

      // --- Model selection (pin only generation models) ---
      const selectedIds = await selectModels(result.models);

      // --- Quality tier assignment (only for selected models) ---
      const selectedModels = result.models.filter(m => selectedIds.includes(m.id));
      const tierMap = await assignTiers(selectedModels);

      // --- CLIP/VAE configuration for UNET models ---
      const config = buildConfig(
        result.backend,
        server.url,
        result.models,
        tierMap,
        selectedIds,
        { token: server.token, tlsInsecure: server.tlsInsecure },
      );
      const unetModels = selectedModels.filter(m => m.type === 'unet');
      if (unetModels.length > 0 && (result.supportFiles.clipFiles.length > 0 || result.supportFiles.vaeFiles.length > 0)) {
        await configureUnetSupportFiles(unetModels, result.supportFiles, config);
      }

      console.log('');
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      step(`Config saved (${configPath})`);
    } else {
      warn('No models found on server');
    }
  }

  // --- Register MCP servers ---
  if (ide === 'claude' || ide === 'both') {
    registerClaudeMcp(scope, projectDir);
  }
  if (ide === 'cursor' || ide === 'both') {
    header('Cursor Integration');
    const cursorScope = scope as CursorScope;
    const cursor = installCursorIntegration(cursorScope, projectDir || process.cwd(), {
      serverUrl: server.url,
      serverToken: server.token,
      tlsInsecure: server.tlsInsecure,
      configPath,
    });
    step(`MCP config: ${cursor.mcpPath}`);
    step(`Rule: ${cursor.rulePath}`);
    detail('Restart Cursor and enable claude-imagine in MCP tools');
  }

  // --- Done ---
  console.log('');
  printLine();
  console.log('');
  console.log(`  ${colors.green}${colors.bold}Installation complete${colors.reset}`);
  console.log('');
  console.log(`  ${colors.bold}Next steps:${colors.reset}`);
  console.log('');
  if (ide === 'claude' || ide === 'both') {
    console.log('    Restart Claude Code, then generate images:');
    console.log(`       ${colors.cyan}/claude-imagine:image-generate${colors.reset}`);
    console.log(`       ${colors.cyan}/claude-imagine:image-suggest${colors.reset}`);
    console.log('');
  }
  if (ide === 'cursor' || ide === 'both') {
    console.log('    Restart Cursor, enable claude-imagine MCP, then ask Composer to generate images.');
    console.log('');
  }
  console.log(`  ${colors.dim}Config: ${configPath}${colors.reset}`);
  console.log(`  ${colors.dim}Edit config to customize model assignments or add models${colors.reset}`);
  console.log('');
}

async function chooseIdeTarget(): Promise<IdeTarget> {
  header('IDE Target');
  console.log('');
  console.log(`    ${colors.cyan}1${colors.reset}  Claude Code  ${colors.dim}(~/.claude/ + claude mcp add)${colors.reset}`);
  console.log(`    ${colors.cyan}2${colors.reset}  Cursor         ${colors.dim}(.cursor/mcp.json + rules)${colors.reset}`);
  console.log(`    ${colors.cyan}3${colors.reset}  Both`);
  console.log('');

  const choice = await promptChoice('Choose [1/2/3]: ', ['1', '2', '3']);
  if (choice === '2') return 'cursor';
  if (choice === '3') return 'both';
  return 'claude';
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

async function configureServer(): Promise<{
  url: string;
  token?: string;
  tlsInsecure: boolean;
}> {
  const configDir = join(homedir(), '.config', 'claude-imagine');
  const configPath = join(configDir, 'config.json');
  const defaultUrl = DEFAULT_BARED_COMFY_URL;

  let currentUrl = '';
  let currentToken = '';
  let currentTlsInsecure = false;
  if (existsSync(configPath)) {
    try {
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      currentUrl = data?.server?.url ?? data?.serverUrl ?? '';
      currentToken = data?.server?.token ?? '';
      currentTlsInsecure = data?.server?.tlsInsecure === true;
    } catch { /* ignore */ }
  }

  const promptDefault = currentUrl || defaultUrl;

  header('Server Configuration');
  console.log('');

  let serverUrl = '';
  let serverToken = process.env['IMAGINE_SERVER_TOKEN'] ?? currentToken;
  let tlsInsecure = currentTlsInsecure
    || process.env['IMAGINE_TLS_INSECURE'] === '1'
    || process.env['IMAGINE_TLS_INSECURE'] === 'true';

  while (true) {
    serverUrl = await prompt('Server URL', promptDefault);

    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      serverUrl = 'http://' + serverUrl;
    }

    if (serverUrl.startsWith('https://')) {
      const tlsAnswer = await prompt(
        'Trust internal/self-signed TLS certificate? [Y/n]',
        tlsInsecure ? 'Y' : 'N',
      );
      tlsInsecure = tlsAnswer === '' || tlsAnswer.toLowerCase().startsWith('y');

      const tokenAnswer = await prompt(
        'Bearer token (leave empty if not required)',
        serverToken,
      );
      serverToken = tokenAnswer.trim();
    }

    process.stdout.write(`  Connecting to ${colors.cyan}${serverUrl}${colors.reset} ... `);

    const reachable = await verifyServerConnection(serverUrl, {
      token: serverToken || undefined,
      tlsInsecure,
    });
    if (reachable) {
      console.log(`${colors.green}OK${colors.reset}`);
      break;
    }

    console.log(`${colors.red}unreachable${colors.reset}`);
    const answer = await prompt('Use this URL anyway? [y/N]', 'N');
    if (answer.toLowerCase().startsWith('y')) break;
    console.log('');
  }

  return {
    url: serverUrl,
    token: serverToken || undefined,
    tlsInsecure,
  };
}

function registerClaudeMcp(scope: 'global' | 'local', projectDir: string): void {
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

async function selectModels(
  models: ReadonlyArray<import('./backends/types.js').DiscoveredModel>,
): Promise<string[]> {
  console.log('');
  header('Model Selection');
  console.log('');
  detail('Select which models to use for image generation.');
  detail('Models not selected will still be available on the server but ignored by claude-imagine.');
  console.log('');

  const selected: string[] = [];
  for (const m of models) {
    const typeColor = m.type === 'checkpoint' ? colors.yellow
      : m.type === 'unet' ? colors.blue : colors.reset;
    const label = `${typeColor}${m.type.padEnd(10)}${colors.reset} ${colors.bold}${m.displayName}${colors.reset}`;
    const answer = await promptChoice(
      `  ${label} — use for generation? [Y/n]: `,
      ['y', 'Y', 'n', 'N', ''],
    );
    if (answer === '' || answer.toLowerCase() === 'y') {
      selected.push(m.id);
      step(`${m.displayName} — included`);
    } else {
      detail(`${m.displayName} — skipped`);
    }
  }

  if (selected.length === 0) {
    warn('No models selected! Including all models as fallback.');
    return models.map(m => m.id);
  }

  return selected;
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
