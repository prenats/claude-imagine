import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Mock config to have models so generation works
vi.mock('../src/config.js', () => ({
  CONFIG: {
    backend: 'comfyui',
    serverUrl: 'http://localhost:8188',
    defaultOutputDir: 'generated',
    models: {
      test_checkpoint: {
        id: 'test_checkpoint',
        filename: 'test_checkpoint.safetensors',
        displayName: 'Test Checkpoint',
        type: 'checkpoint',
        tier: 'fast' as const,
        params: { steps: 4, cfg: 1.0, sampler: 'euler', scheduler: 'sgm_uniform' },
      },
      test_unet: {
        id: 'test_unet',
        filename: 'test_unet.safetensors',
        displayName: 'Test UNet',
        type: 'unet',
        tier: 'high' as const,
        params: { steps: 20, cfg: 1.0, sampler: 'euler', scheduler: 'simple' },
      },
    },
    imageTypes: {
      ICON: { model: 'test_checkpoint' },
      THUMBNAIL: { model: 'test_checkpoint' },
      BACKGROUND: { model: 'test_checkpoint' },
      TEXTURE: { model: 'test_checkpoint' },
      AVATAR: { model: 'test_checkpoint' },
      CONTENT: { model: 'test_checkpoint' },
      BANNER: { model: 'test_checkpoint' },
      PRODUCT: { model: 'test_checkpoint' },
      LOGO: { model: 'test_unet' },
      HERO: { model: 'test_unet' },
      FEATURED: { model: 'test_unet' },
    },
  },
  DEFAULT_SERVER_URL: 'http://localhost:8188',
  DEFAULT_OUTPUT_DIR: 'generated',
  resolveModel: (ref: string, models: Record<string, unknown>) => (models as Record<string, unknown>)[ref],
  loadConfig: vi.fn(),
}));

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSingle } from '../src/generate.js';
import type { ImageBackend } from '../src/backends/types.js';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function createMockBackend(): ImageBackend {
  return {
    name: 'mock',
    detect: vi.fn().mockResolvedValue(true),
    discoverModels: vi.fn().mockResolvedValue([]),
    generate: vi.fn().mockResolvedValue({
      imageBytes: PNG_BYTES,
      metadata: { model: 'test', elapsedMs: 1000 },
    }),
    checkHealth: vi.fn().mockResolvedValue(true),
  };
}

let mockBackend: ImageBackend;

beforeEach(() => {
  mockBackend = createMockBackend();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateSingle', () => {
  it('throws GenerationError for invalid image type', async () => {
    await expect(generateSingle({
      image_type: 'INVALID',
      description: 'test',
      output_path: 'out.png',
    }, mockBackend)).rejects.toThrow("Unknown image_type 'INVALID'");
  });

  it('calls backend.generate and writes result', async () => {
    const result = await generateSingle({
      image_type: 'ICON',
      description: 'a lock icon',
      output_path: 'test-output/test-icon.png',
      seed: 42,
    }, mockBackend);

    expect(mockBackend.generate).toHaveBeenCalledOnce();
    expect(result).toContain('Saved:');
    expect(result).toContain('ICON');
  });

  it('writes image bytes to the output path', async () => {
    await generateSingle({
      image_type: 'ICON',
      description: 'test',
      output_path: 'test-output/icon.png',
      seed: 1,
    }, mockBackend);

    expect(mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('test-output'),
      { recursive: true },
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      resolve('test-output/icon.png'),
      PNG_BYTES,
    );
  });

  it('returns summary with model, dimensions, size, and seed', async () => {
    const result = await generateSingle({
      image_type: 'THUMBNAIL',
      description: 'a colorful thumbnail',
      output_path: 'test-output/thumb.png',
      seed: 999,
    }, mockBackend);

    expect(result).toContain('THUMBNAIL');
    expect(result).toContain('test_checkpoint');
    expect(result).toContain('768x432');
    expect(result).toContain('Seed: 999');
    expect(result).toContain(`${(PNG_BYTES.length / 1024).toFixed(1)} KB`);
  });

  it('rejects output paths that escape the working directory', async () => {
    await expect(generateSingle({
      image_type: 'ICON',
      description: 'test',
      output_path: '/tmp/escape.png',
      seed: 1,
    }, mockBackend)).rejects.toThrow('resolves outside the working directory');

    await expect(generateSingle({
      image_type: 'ICON',
      description: 'test',
      output_path: '../../escape.png',
      seed: 1,
    }, mockBackend)).rejects.toThrow('resolves outside the working directory');
  });

  it('is case-insensitive for image_type', async () => {
    const result = await generateSingle({
      image_type: 'hero',
      description: 'test',
      output_path: 'out.png',
      seed: 1,
    }, mockBackend);
    expect(result).toContain('HERO');
  });

  it('propagates backend errors', async () => {
    vi.mocked(mockBackend.generate).mockRejectedValue(new Error('connection refused'));

    await expect(generateSingle({
      image_type: 'ICON',
      description: 'test',
      output_path: 'out.png',
      seed: 1,
    }, mockBackend)).rejects.toThrow('connection refused');
  });

  it('falls back to type default when model is unknown', async () => {
    const result = await generateSingle({
      image_type: 'ICON',
      description: 'test',
      output_path: 'out.png',
      model: 'nonexistent_model',
      seed: 1,
    }, mockBackend);

    // Unknown model falls through to image type default (test_checkpoint)
    expect(result).toContain('Saved:');
    expect(result).toContain('test_checkpoint');
  });
});
