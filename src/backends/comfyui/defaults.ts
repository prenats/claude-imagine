/** Fallback model parameters for ComfyUI when config has no params for a model. */

export interface DefaultModelParams {
  readonly steps: number;
  readonly cfg: number;
  readonly sampler: string;
  readonly scheduler: string;
}

/** Default params by model type + filename heuristics. */
export function getDefaultParams(
  filename: string,
  modelType: 'checkpoint' | 'unet' | string,
): DefaultModelParams {
  const lower = filename.toLowerCase();

  // Lightning models — fast, low cfg
  if (lower.includes('lightning') || lower.includes('turbo')) {
    return { steps: 4, cfg: 1.0, sampler: 'euler', scheduler: 'sgm_uniform' };
  }

  // Flux Schnell — fast Flux
  if (lower.includes('schnell')) {
    return { steps: 4, cfg: 1.0, sampler: 'euler', scheduler: 'simple' };
  }

  // Flux Dev — quality Flux
  if (lower.includes('flux') && (lower.includes('dev') || lower.includes('pro'))) {
    return { steps: 20, cfg: 1.0, sampler: 'euler', scheduler: 'simple' };
  }

  // Generic UNET (assume Flux-like)
  if (modelType === 'unet') {
    return { steps: 20, cfg: 1.0, sampler: 'euler', scheduler: 'simple' };
  }

  // Generic checkpoint (assume SD-like)
  return { steps: 20, cfg: 7.0, sampler: 'euler', scheduler: 'normal' };
}

/**
 * Suggest a quality tier based on filename heuristics.
 * Used as a default during interactive setup — user can override.
 */
export function suggestTier(filename: string, modelType: string): 'fast' | 'standard' | 'high' {
  const lower = filename.toLowerCase();

  if (lower.includes('lightning') || lower.includes('turbo')) return 'fast';
  if (lower.includes('schnell')) return 'fast';
  if (lower.includes('flux') && lower.includes('dev')) return 'high';
  if (lower.includes('flux') && lower.includes('pro')) return 'high';
  if (modelType === 'unet') return 'standard';
  return 'standard';
}
