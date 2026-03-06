/** Core image generation logic — backend-agnostic orchestrator. */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { CONFIG, resolveModel } from './config.js';
import { IMAGE_TYPE_DEFAULTS } from './image-types.js';
import { buildPrompt } from './prompt-builder.js';
import { GenerationError } from './errors.js';
import type { ImageBackend } from './backends/types.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Validate that the output path doesn't escape the working directory. */
function validateOutputPath(outputPath: string): string {
  const absPath = resolve(outputPath);
  const cwd = process.cwd();
  const rel = relative(cwd, absPath);

  if (rel.startsWith('..') || resolve(cwd, rel) !== absPath) {
    throw new GenerationError(
      `Output path '${outputPath}' resolves outside the working directory. ` +
      'Use a relative path within the project.',
    );
  }

  return absPath;
}

export interface GenerateParams {
  readonly image_type: string;
  readonly description: string;
  readonly output_path?: string;
  readonly style?: string;
  readonly mood?: string;
  readonly color_palette?: string;
  readonly composition?: string;
  readonly lighting?: string;
  readonly negative_prompt?: string;
  readonly model?: string;
  readonly quality?: string;
  readonly width?: number;
  readonly height?: number;
  readonly seed?: number;
}

export async function generateSingle(
  params: GenerateParams,
  backend: ImageBackend,
): Promise<string> {
  const imageType = params.image_type.toUpperCase();

  if (!(imageType in IMAGE_TYPE_DEFAULTS)) {
    throw new GenerationError(
      `Unknown image_type '${params.image_type}'. ` +
      `Valid types: ${Object.keys(IMAGE_TYPE_DEFAULTS).sort().join(', ')}`,
    );
  }

  if (Object.keys(CONFIG.models).length === 0) {
    throw new GenerationError(
      'No models configured. Run ./install.sh to auto-detect your server and discover models.',
    );
  }

  const outputPath = params.output_path
    ?? join(CONFIG.defaultOutputDir, `${slugify(params.description)}.png`);

  const request = {
    imageType,
    description: params.description,
    outputPath,
    style: params.style,
    mood: params.mood,
    colorPalette: params.color_palette,
    composition: params.composition,
    lighting: params.lighting,
    negativePrompt: params.negative_prompt,
    model: params.model,
    quality: params.quality,
    width: params.width,
    height: params.height,
    seed: params.seed,
  };

  const built = buildPrompt(request);

  // Resolve the model definition from config
  const modelDef = resolveModel(built.model, CONFIG.models);
  if (!modelDef) {
    throw new GenerationError(
      `Unknown model '${built.model}'. Available: ${Object.keys(CONFIG.models).join(', ')}`,
    );
  }

  const absPath = validateOutputPath(outputPath);

  const result = await backend.generate(built, modelDef, CONFIG.serverUrl);
  const elapsed = result.metadata.elapsedMs / 1000;

  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, result.imageBytes);

  const sizeKb = result.imageBytes.length / 1024;
  return (
    `Saved: ${absPath}\n` +
    `Type: ${imageType} | Model: ${built.model} | ` +
    `Size: ${built.width}x${built.height} | File: ${sizeKb.toFixed(1)} KB | ` +
    `Time: ${elapsed.toFixed(1)}s | Seed: ${built.seed}\n` +
    `Prompt: ${built.positive.length > 120 ? built.positive.slice(0, 120) + '...' : built.positive}`
  );
}
