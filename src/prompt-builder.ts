/** Prompt builder for image generation — verbatim passthrough. */

import type { GenerationRequest, BuiltPrompt, ModelDefinition } from './models.js';
import { IMAGE_TYPE_DEFAULTS } from './image-types.js';
import { buildNegativePrompt } from './negative-prompts.js';
import { GenerationError } from './errors.js';
import { CONFIG } from './config.js';

/**
 * Build a BuiltPrompt from a GenerationRequest.
 * The description is always used verbatim as the positive prompt.
 *
 * Model resolution order:
 *   1. Explicit model param (by ID)
 *   2. Quality tier mapping (fast/standard/high → by model tier)
 *   3. Image type default from config.imageTypes
 */
export function buildPrompt(request: GenerationRequest): BuiltPrompt {
  const imageType = request.imageType.toUpperCase();
  const defaults = IMAGE_TYPE_DEFAULTS[imageType];

  // Resolve dimensions: user override > config override > hardcoded default, clamp 64–1536, round to 8
  const typeConfig = CONFIG.imageTypes[imageType];
  const rawWidth = request.width ?? typeConfig?.width ?? defaults.width;
  const rawHeight = request.height ?? typeConfig?.height ?? defaults.height;
  const width = Math.floor(Math.min(Math.max(rawWidth, 64), 1536) / 8) * 8;
  const height = Math.floor(Math.min(Math.max(rawHeight, 64), 1536) / 8) * 8;

  // Resolve seed
  const seed = request.seed !== undefined
    ? request.seed
    : Math.floor(Math.random() * 2 ** 32);

  // Build negative prompt using style key
  const styleKey = (request.style ?? defaults.defaultStyle).toLowerCase();
  const negative = buildNegativePrompt(imageType, styleKey, request.negativePrompt);

  // Resolve model
  const model = resolveModelId(request, imageType);

  return {
    positive: request.description,
    negative,
    model,
    width,
    height,
    seed,
  };
}

function resolveModelId(request: GenerationRequest, imageType: string): string {
  const configModels = CONFIG.models;

  // 1. Explicit model param — direct ID lookup
  if (request.model && request.model in configModels) {
    return request.model;
  }

  // 2. Quality tier mapping
  if (request.quality) {
    const qualityModel = resolveQualityTier(request.quality.toLowerCase(), configModels);
    if (qualityModel) return qualityModel;
  }

  // 3. Image type default from config
  const typeConfig = CONFIG.imageTypes[imageType];
  if (typeConfig) return typeConfig.model;

  // Fallback: first available model
  const modelIds = Object.keys(configModels);
  if (modelIds.length === 0) {
    throw new GenerationError(
      'No model could be resolved: no explicit model, no quality tier match, ' +
      `no image type default for '${imageType}', and no models configured.`,
    );
  }
  return modelIds[0];
}

function resolveQualityTier(
  quality: string,
  models: Readonly<Record<string, ModelDefinition>>,
): string | undefined {
  if (quality !== 'fast' && quality !== 'standard' && quality !== 'high') {
    return undefined;
  }

  const match = Object.values(models).find(m => m.tier === quality);
  return match?.id;
}
