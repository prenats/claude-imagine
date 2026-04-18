#!/usr/bin/env node
/**
 * Reconfigure CLI — re-select which models to use for generation
 * without re-running the full setup.
 *
 * Reads the existing config, re-discovers models from the server,
 * and lets the user pick which ones to pin for generation.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import {
  colors, step, warn, fail, header, detail, printLine,
  getVersion, promptChoice,
} from './cli-ui.js';
import { detectAndDiscover, isSetupError, buildConfig } from './setup-core.js';
import { suggestTier } from './backends/comfyui/defaults.js';
import type { QualityTier } from './setup-core.js';
import type { DiscoveredModel } from './backends/types.js';

const configDir = join(homedir(), '.config', 'claude-imagine');
const configPath = join(configDir, 'config.json');

async function main(): Promise<void> {
  const version = getVersion();
  console.log(`\n  ${colors.bold}claude-imagine${colors.reset} v${version} — Reconfigure models\n`);

  if (!existsSync(configPath)) {
    fail('No config found. Run setup first: claude-imagine setup');
    process.exit(1);
  }

  const existing = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  const serverUrl = (existing['server'] as Record<string, unknown>)?.['url'] as string
    ?? (existing['serverUrl'] as string)
    ?? 'http://localhost:8188';

  header('Discovering models');
  const result = await detectAndDiscover(serverUrl);

  if (isSetupError(result)) {
    fail(`Cannot reach server at ${serverUrl}: ${result.error}`);
    process.exit(1);
  }

  step(`Found ${result.models.length} models on ${serverUrl}`);

  // Load existing pinned list for defaults
  const existingPinned = new Set<string>(
    Array.isArray(existing['pinnedModels'])
      ? (existing['pinnedModels'] as string[])
      : [],
  );

  // --- Model selection ---
  console.log('');
  header('Model Selection');
  console.log('');
  detail('Select which models to use for image generation.');
  detail('Current pinned models are pre-selected (shown as [Y/n]).');
  console.log('');

  const selectedIds: string[] = [];
  for (const m of result.models) {
    const wasPinned = existingPinned.size === 0 || existingPinned.has(m.id);
    const defaultAnswer = wasPinned ? 'Y' : 'N';
    const typeColor = m.type === 'checkpoint' ? colors.yellow
      : m.type === 'unet' ? colors.blue : colors.reset;
    const label = `${typeColor}${m.type.padEnd(10)}${colors.reset} ${colors.bold}${m.displayName}${colors.reset}`;
    const hint = wasPinned ? '[Y/n]' : '[y/N]';
    const answer = await promptChoice(
      `  ${label} ${hint}: `,
      ['y', 'Y', 'n', 'N', ''],
    );

    const include = answer === ''
      ? wasPinned
      : answer.toLowerCase() === 'y';

    if (include) {
      selectedIds.push(m.id);
      step(`${m.displayName} — included`);
    } else {
      detail(`${m.displayName} — skipped`);
    }
  }

  if (selectedIds.length === 0) {
    warn('No models selected! Keeping existing config unchanged.');
    process.exit(0);
  }

  // --- Tier assignment for selected models ---
  const selectedModels = result.models.filter(m => selectedIds.includes(m.id));
  const tierMap = await assignTiers(selectedModels, existing);

  // Build new config, preserving all models but pinning only selected
  const config = buildConfig(result.backend, serverUrl, result.models, tierMap, selectedIds);

  // Preserve CLIP/VAE params from existing config for unet models
  preserveUnetParams(config, existing);

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log('');
  step(`Config updated (${configPath})`);
  console.log('');
  console.log(`  ${colors.green}${colors.bold}Reconfiguration complete${colors.reset}`);
  console.log(`  ${colors.dim}Pinned models: ${selectedIds.join(', ')}${colors.reset}`);
  console.log('');
}

async function assignTiers(
  models: ReadonlyArray<DiscoveredModel>,
  existing: Record<string, unknown>,
): Promise<Record<string, QualityTier>> {
  console.log('');
  header('Quality Tier Assignment');
  console.log('');
  detail('  fast     = ICON, THUMBNAIL, BACKGROUND, TEXTURE');
  detail('  standard = AVATAR, CONTENT, BANNER, PRODUCT');
  detail('  high     = LOGO, HERO, FEATURED');
  console.log('');

  const existingModels = (existing['models'] ?? {}) as Record<string, Record<string, unknown>>;
  const tierMap: Record<string, QualityTier> = {};
  const tierChoices = ['fast', 'standard', 'high'] as const;

  for (const m of models) {
    const existingTier = existingModels[m.id]?.['tier'] as string | undefined;
    const suggested = existingTier && ['fast', 'standard', 'high'].includes(existingTier)
      ? existingTier as QualityTier
      : suggestTier(m.filename, m.type);

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

function preserveUnetParams(
  newConfig: Record<string, unknown>,
  existing: Record<string, unknown>,
): void {
  const newModels = newConfig['models'] as Record<string, Record<string, unknown>> | undefined;
  const oldModels = existing['models'] as Record<string, Record<string, unknown>> | undefined;
  if (!newModels || !oldModels) return;

  for (const [id, newDef] of Object.entries(newModels)) {
    const oldDef = oldModels[id];
    if (!oldDef) continue;

    const oldParams = oldDef['params'] as Record<string, unknown> | undefined;
    if (!oldParams) continue;

    // Preserve clip/vae selections from existing config
    const newParams = { ...(newDef['params'] as Record<string, unknown> ?? {}) };
    for (const key of ['clip_name1', 'clip_name2', 'vae_name']) {
      if (oldParams[key] && !newParams[key]) {
        newParams[key] = oldParams[key];
      }
    }
    newDef['params'] = newParams;
  }
}

main().catch((e) => {
  console.error(`\n  ${colors.red}Error:${colors.reset} ${e}`);
  process.exit(1);
});
