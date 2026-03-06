import { describe, it, expect, vi } from 'vitest';

// Mock config so prompt-builder has models to work with
vi.mock('../src/config.js', () => ({
  CONFIG: {
    backend: 'comfyui',
    serverUrl: 'http://localhost:8188',
    defaultOutputDir: 'generated',
    models: {
      fast_model: {
        id: 'fast_model',
        filename: 'fast.safetensors',
        displayName: 'Fast Model',
        type: 'checkpoint',
        tier: 'fast' as const,
        params: { steps: 4, cfg: 1.0, sampler: 'euler', scheduler: 'sgm_uniform' },
      },
      mid_model: {
        id: 'mid_model',
        filename: 'mid.safetensors',
        displayName: 'Mid Model',
        type: 'unet',
        tier: 'standard' as const,
        params: { steps: 4, cfg: 1.0, sampler: 'euler', scheduler: 'simple' },
      },
      slow_model: {
        id: 'slow_model',
        filename: 'slow.safetensors',
        displayName: 'Slow Model',
        type: 'unet',
        tier: 'high' as const,
        params: { steps: 20, cfg: 1.0, sampler: 'euler', scheduler: 'simple' },
      },
    },
    imageTypes: {
      ICON: { model: 'fast_model' },
      THUMBNAIL: { model: 'fast_model' },
      BACKGROUND: { model: 'fast_model' },
      TEXTURE: { model: 'fast_model' },
      AVATAR: { model: 'mid_model' },
      CONTENT: { model: 'mid_model' },
      BANNER: { model: 'mid_model' },
      PRODUCT: { model: 'mid_model' },
      LOGO: { model: 'slow_model', width: 256, height: 256 },
      HERO: { model: 'slow_model' },
      FEATURED: { model: 'slow_model' },
    },
  },
  DEFAULT_SERVER_URL: 'http://localhost:8188',
  DEFAULT_OUTPUT_DIR: 'generated',
  resolveModel: (ref: string, models: Record<string, unknown>) => (models as Record<string, unknown>)[ref],
  loadConfig: vi.fn(),
}));

import { buildPrompt } from '../src/prompt-builder.js';
import { IMAGE_TYPE_DEFAULTS } from '../src/image-types.js';
import type { GenerationRequest } from '../src/models.js';

const ALL_IMAGE_TYPES = Object.keys(IMAGE_TYPE_DEFAULTS);

function makeRequest(overrides: Partial<GenerationRequest> & {
  imageType: string;
  description: string;
  outputPath: string;
}): GenerationRequest {
  return {
    imageType: overrides.imageType,
    description: overrides.description,
    outputPath: overrides.outputPath,
    ...overrides,
  };
}

describe('All image types', () => {
  it('produces valid prompts for every type', () => {
    for (const imageType of ALL_IMAGE_TYPES) {
      const result = buildPrompt(makeRequest({ imageType, description: 'a beautiful scene', outputPath: 'out.png', seed: 1 }));
      expect(result.positive, `Empty positive for ${imageType}`).toBeTruthy();
      expect(result.negative, `Empty negative for ${imageType}`).toBeTruthy();
      expect(result.seed).toBe(1);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    }
  });

  it('is case-insensitive for imageType', () => {
    const upper = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', seed: 5 }));
    const lower = buildPrompt(makeRequest({ imageType: 'hero', description: 'test', outputPath: 'x.png', seed: 5 }));
    expect(upper.positive).toBe(lower.positive);
    expect(upper.width).toBe(lower.width);
  });
});

describe('Verbatim passthrough', () => {
  it('uses the description exactly as the positive prompt', () => {
    const crafted =
      'Intimate interior of an artisan coffee shop, warm amber Edison bulb ' +
      'lighting, rain-streaked windows, steam rising from ceramic vessels, ' +
      'masterpiece, award-winning, ultra-detailed, 8k resolution';
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: crafted, outputPath: 'out.png', seed: 42 }));
    expect(result.positive).toBe(crafted);
  });

  it('still builds a negative prompt', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'a detailed prompt', outputPath: 'out.png', seed: 1 }));
    expect(result.negative).toBeTruthy();
    expect(result.negative).toContain('ugly');
  });
});

describe('Model selection', () => {
  it('fast types default to fast_model', () => {
    for (const t of ['ICON', 'THUMBNAIL', 'BACKGROUND', 'TEXTURE']) {
      const result = buildPrompt(makeRequest({ imageType: t, description: 'test', outputPath: 'x.png', seed: 1 }));
      expect(result.model, `${t} should default to fast_model`).toBe('fast_model');
    }
  });

  it('medium types default to mid_model', () => {
    for (const t of ['AVATAR', 'CONTENT', 'BANNER', 'PRODUCT']) {
      const result = buildPrompt(makeRequest({ imageType: t, description: 'test', outputPath: 'x.png', seed: 1 }));
      expect(result.model, `${t} should default to mid_model`).toBe('mid_model');
    }
  });

  it('high types default to slow_model', () => {
    for (const t of ['LOGO', 'HERO', 'FEATURED']) {
      const result = buildPrompt(makeRequest({ imageType: t, description: 'test', outputPath: 'x.png', seed: 1 }));
      expect(result.model, `${t} should default to slow_model`).toBe('slow_model');
    }
  });

  it('explicit model overrides type default', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', model: 'fast_model', seed: 1 }));
    expect(result.model).toBe('fast_model');
  });

  it('quality=fast overrides type default', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', quality: 'fast', seed: 1 }));
    expect(result.model).toBe('fast_model');
  });

  it('quality=standard overrides type default', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', quality: 'standard', seed: 1 }));
    expect(result.model).toBe('mid_model');
  });

  it('quality=high overrides type default', () => {
    const result = buildPrompt(makeRequest({ imageType: 'ICON', description: 'test', outputPath: 'x.png', quality: 'high', seed: 1 }));
    expect(result.model).toBe('slow_model');
  });

  it('explicit model takes priority over quality', () => {
    const result = buildPrompt(makeRequest({ imageType: 'ICON', description: 'test', outputPath: 'x.png', model: 'slow_model', quality: 'fast', seed: 1 }));
    expect(result.model).toBe('slow_model');
  });
});

describe('Dimensions', () => {
  it('uses type defaults when config has no overrides', () => {
    const checks: Record<string, [number, number]> = {
      ICON: [512, 512],
      THUMBNAIL: [768, 432],
      BACKGROUND: [1344, 768],
      HERO: [1344, 768],
      PRODUCT: [896, 1152],
    };
    for (const [imageType, [w, h]] of Object.entries(checks)) {
      const result = buildPrompt(makeRequest({ imageType, description: 'test', outputPath: 'x.png', seed: 1 }));
      expect(result.width, `${imageType} width`).toBe(w);
      expect(result.height, `${imageType} height`).toBe(h);
    }
  });

  it('respects width/height overrides', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', width: 800, height: 600, seed: 1 }));
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('caps dimensions at 1536', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', width: 9999, height: 9999, seed: 1 }));
    expect(result.width).toBeLessThanOrEqual(1536);
    expect(result.height).toBeLessThanOrEqual(1536);
  });

  it('uses config overrides over hardcoded defaults', () => {
    // LOGO hardcoded default is 1024x1024, but config overrides to 256x256
    const result = buildPrompt(makeRequest({ imageType: 'LOGO', description: 'test', outputPath: 'x.png', seed: 1 }));
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('per-request dimensions override config overrides', () => {
    // LOGO config is 256x256, but per-request 800x600 should win
    const result = buildPrompt(makeRequest({ imageType: 'LOGO', description: 'test', outputPath: 'x.png', width: 800, height: 600, seed: 1 }));
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('falls back to hardcoded defaults when config has no overrides', () => {
    // HERO has no width/height in config, should use hardcoded 1344x768
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', seed: 1 }));
    expect(result.width).toBe(1344);
    expect(result.height).toBe(768);
  });

  it('rounds dimensions down to multiples of 8', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', width: 1345, height: 771, seed: 1 }));
    expect(result.width % 8).toBe(0);
    expect(result.height % 8).toBe(0);
  });
});

describe('Seed', () => {
  it('preserves the given seed', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png', seed: 12345 }));
    expect(result.seed).toBe(12345);
  });

  it('generates a random seed when not provided', () => {
    const result = buildPrompt(makeRequest({ imageType: 'HERO', description: 'test', outputPath: 'x.png' }));
    expect(result.seed).toBeDefined();
    expect(result.seed).toBeGreaterThanOrEqual(0);
    expect(result.seed).toBeLessThan(2 ** 32);
  });

  it('generates different seeds on repeated calls (probabilistic)', () => {
    const seeds = Array.from({ length: 5 }, () =>
      buildPrompt(makeRequest({ imageType: 'ICON', description: 'test', outputPath: 'x.png' })).seed,
    );
    const unique = new Set(seeds);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('Invalid overrides fall back to type defaults', () => {
  it('unknown model string falls back to type default', () => {
    const result = buildPrompt(makeRequest({
      imageType: 'HERO',
      description: 'test',
      outputPath: 'x.png',
      model: 'nonexistent_model',
      seed: 1,
    }));
    expect(result.model).toBe('slow_model'); // HERO default
  });

  it('unknown quality string falls back to type default', () => {
    const result = buildPrompt(makeRequest({
      imageType: 'ICON',
      description: 'test',
      outputPath: 'x.png',
      quality: 'ultra_mega',
      seed: 1,
    }));
    expect(result.model).toBe('fast_model'); // ICON default
  });
});

describe('Minimal call', () => {
  it('works with only 3 required params', () => {
    const result = buildPrompt({ imageType: 'ICON', description: 'a simple lock icon', outputPath: 'icon.png' });
    expect(result.positive).toBe('a simple lock icon');
    expect(result.negative).toBeTruthy();
    expect(result.seed).toBeDefined();
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
  });
});
