/**
 * Pure logic for backend detection and model discovery.
 * No side effects — no process.exit, no console output.
 * Used by both setup-cli.ts (npx) and setup.ts (install.sh).
 */

// Register all backends
import './backends/comfyui/index.js';

import { detectBackend } from './backends/detect.js';
import type { DiscoveredModel } from './backends/types.js';
import type { SupportFiles } from './backends/comfyui/discover.js';

const IMAGE_TYPE_TIERS: Readonly<Record<string, 'fast' | 'standard' | 'high'>> = {
  ICON: 'fast',
  THUMBNAIL: 'fast',
  BACKGROUND: 'fast',
  TEXTURE: 'fast',
  AVATAR: 'standard',
  CONTENT: 'standard',
  BANNER: 'standard',
  PRODUCT: 'standard',
  LOGO: 'high',
  HERO: 'high',
  FEATURED: 'high',
};

export type QualityTier = 'fast' | 'standard' | 'high';

export interface SetupResult {
  readonly backend: string;
  readonly models: ReadonlyArray<DiscoveredModel>;
  readonly supportFiles: SupportFiles;
}

export interface SetupError {
  readonly error: string;
}

export async function detectAndDiscover(serverUrl: string): Promise<SetupResult | SetupError> {
  const backend = await detectBackend(serverUrl);
  if (!backend) {
    return { error: 'No supported backend detected' };
  }

  let models: ReadonlyArray<DiscoveredModel>;
  try {
    models = await backend.discoverModels(serverUrl);
  } catch (e) {
    return { error: `Model discovery failed: ${e}` };
  }

  // Discover CLIP/VAE support files (best-effort, empty arrays on failure)
  let supportFiles: SupportFiles = { clipFiles: [], vaeFiles: [] };
  try {
    const { discoverSupportFiles } = await import('./backends/comfyui/discover.js');
    supportFiles = await discoverSupportFiles(serverUrl);
  } catch {
    // Non-fatal — user can configure manually
  }

  return { backend: backend.name, models, supportFiles };
}

/**
 * Assign models to image types based on user-chosen tiers.
 * Each image type has a tier (fast/standard/high) and gets the first model matching that tier.
 * Falls back to the first model if no tier match is found.
 */
export function assignModelsByTier(
  tierMap: Readonly<Record<string, QualityTier>>,
): Record<string, { model: string }> {
  const tierToModel: Record<string, string | undefined> = {};
  for (const [modelId, tier] of Object.entries(tierMap)) {
    if (!tierToModel[tier]) {
      tierToModel[tier] = modelId;
    }
  }

  const fallback = Object.keys(tierMap)[0];
  const result: Record<string, { model: string }> = {};
  for (const [type, tier] of Object.entries(IMAGE_TYPE_TIERS)) {
    result[type] = { model: tierToModel[tier] ?? fallback };
  }

  return result;
}

/**
 * Build the config JSON object from setup results + user tier choices.
 */
export function buildConfig(
  backendName: string,
  serverUrl: string,
  models: ReadonlyArray<DiscoveredModel>,
  tierMap: Readonly<Record<string, QualityTier>>,
): Record<string, unknown> {
  const modelsRecord: Record<string, unknown> = {};
  for (const m of models) {
    modelsRecord[m.id] = {
      filename: m.filename,
      displayName: m.displayName,
      type: m.type,
      tier: tierMap[m.id],
      params: m.params,
    };
  }

  const imageTypes = assignModelsByTier(tierMap);

  return {
    backend: backendName,
    server: { url: serverUrl },
    models: modelsRecord,
    imageTypes,
    output: { dir: 'generated' },
  };
}

export function isSetupError(result: SetupResult | SetupError): result is SetupError {
  return 'error' in result;
}
