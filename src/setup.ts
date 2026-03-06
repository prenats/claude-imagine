#!/usr/bin/env node
/**
 * CLI helper for install-time backend detection and model discovery.
 * Used by install.sh (git clone flow).
 *
 * Usage: node dist/setup.js <server-url>
 *
 * Outputs to stderr:
 *   BACKEND:<name>
 *   MODELS:<count>
 *   MODEL:<type>:<filename>:<displayName>:<suggestedTier>
 *   HAS_UNETS:true (if applicable)
 *   CLIP_FILE:<filename>
 *   VAE_FILE:<filename>
 *
 * Accepts tier assignments on stdin (one per line: <modelId>:<tier>)
 * then writes JSON config to stdout.
 */

import { detectAndDiscover, isSetupError, buildConfig } from './setup-core.js';
import { suggestTier } from './backends/comfyui/defaults.js';
import type { QualityTier } from './setup-core.js';

const log = (msg: string) => { process.stderr.write(msg + '\n'); };

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url || url.startsWith('--')) {
    console.error('Usage: node dist/setup.js <server-url>');
    process.exit(1);
  }

  const result = await detectAndDiscover(url);

  if (isSetupError(result)) {
    log(`BACKEND:FAIL`);
    log(`SETUP_ERROR:${result.error}`);
    process.exit(2);
  }

  log(`BACKEND:${result.backend}`);
  log(`MODELS:${result.models.length}`);

  for (const m of result.models) {
    const suggested = suggestTier(m.filename, m.type);
    log(`MODEL:${m.type}:${m.filename}:${m.displayName}:${suggested}`);
  }

  const hasUnets = result.models.some(m => m.type === 'unet');
  if (hasUnets) {
    log('');
    log('HAS_UNETS:true');
    for (const f of result.supportFiles.clipFiles) {
      log(`CLIP_FILE:${f}`);
    }
    for (const f of result.supportFiles.vaeFiles) {
      log(`VAE_FILE:${f}`);
    }
  }

  // Read tier assignments from stdin
  const tierMap: Record<string, QualityTier> = {};
  const stdinData = await readStdin();
  for (const line of stdinData.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [modelId, tier] = trimmed.split(':');
    if (modelId && ['fast', 'standard', 'high'].includes(tier)) {
      tierMap[modelId] = tier as QualityTier;
    }
  }

  // If no tier assignments received, use suggested tiers
  if (Object.keys(tierMap).length === 0) {
    for (const m of result.models) {
      tierMap[m.id] = suggestTier(m.filename, m.type);
    }
  }

  const config = buildConfig(result.backend, url, result.models, tierMap);
  console.log(JSON.stringify(config, null, 2));
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.resume();
  });
}

main().catch(e => {
  log(`SETUP_ERROR:${e}`);
  process.exit(1);
});
