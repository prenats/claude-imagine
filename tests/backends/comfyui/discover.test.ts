import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/backends/comfyui/client.js', () => ({
  httpRequest: vi.fn(),
}));

import { discoverModels, discoverSupportFiles } from '../../../src/backends/comfyui/discover.js';
import { httpRequest } from '../../../src/backends/comfyui/client.js';

function mockResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

function mockErrorResponse(): Response {
  return { ok: false, json: async () => null } as Response;
}

beforeEach(() => {
  vi.mocked(httpRequest).mockReset();
});

describe('discoverModels — object_info primary', () => {
  it('discovers checkpoints and diffusion models via loader nodes', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      if (url.includes('/object_info/CheckpointLoaderSimple')) {
        return mockResponse({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['sdxl_lightning_4step.safetensors', 'sd15.safetensors']],
              },
            },
          },
        });
      }
      if (url.includes('/object_info/UNETLoader')) {
        return mockResponse({
          UNETLoader: {
            input: {
              required: {
                unet_name: [['flux1-schnell.safetensors', 'flux1-dev.safetensors']],
              },
            },
          },
        });
      }
      return mockErrorResponse();
    });

    const models = await discoverModels('http://localhost:8188');

    expect(models.length).toBe(4);
    expect(models.filter(m => m.type === 'checkpoint').length).toBe(2);
    expect(models.filter(m => m.type === 'unet').length).toBe(2);
    expect(models.some(m => m.filename === 'flux1-schnell.safetensors')).toBe(true);
    expect(models.some(m => m.filename === 'flux1-dev.safetensors')).toBe(true);
  });

  it('deduplicates models that appear in multiple loaders', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      if (url.includes('/object_info/CheckpointLoaderSimple')) {
        return mockResponse({
          CheckpointLoaderSimple: {
            input: { required: { ckpt_name: [['shared.safetensors']] } },
          },
        });
      }
      if (url.includes('/object_info/UNETLoader')) {
        return mockResponse({
          UNETLoader: {
            input: { required: { unet_name: [['shared.safetensors']] } },
          },
        });
      }
      return mockErrorResponse();
    });

    const models = await discoverModels('http://localhost:8188');
    // Same filename should only appear once (from the first loader)
    expect(models.filter(m => m.filename === 'shared.safetensors').length).toBe(1);
  });
});

describe('discoverModels — folder fallback', () => {
  it('falls back to /models/{folder} when object_info returns nothing', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      // object_info endpoints fail
      if (url.includes('/object_info/')) return mockErrorResponse();

      // folder endpoints work
      if (url.includes('/models/checkpoints')) {
        return mockResponse(['sdxl_lightning_4step.safetensors']);
      }
      if (url.includes('/models/diffusion_models')) {
        return mockResponse(['flux1-schnell.safetensors']);
      }
      if (url.includes('/models/unet')) {
        return mockResponse([]);
      }
      return mockErrorResponse();
    });

    const models = await discoverModels('http://localhost:8188');

    expect(models.length).toBe(2);
    expect(models.some(m => m.type === 'checkpoint')).toBe(true);
    expect(models.some(m => m.type === 'unet')).toBe(true);
  });

  it('scans diffusion_models folder for Flux models', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      if (url.includes('/object_info/')) return mockErrorResponse();

      if (url.includes('/models/diffusion_models')) {
        return mockResponse(['flux1-dev.safetensors', 'flux1-schnell.safetensors']);
      }
      return mockResponse([]);
    });

    const models = await discoverModels('http://localhost:8188');

    expect(models.length).toBe(2);
    expect(models.every(m => m.type === 'unet')).toBe(true);
  });
});

describe('discoverSupportFiles', () => {
  it('discovers CLIP and VAE files from loader nodes', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      if (url.includes('/object_info/DualCLIPLoader')) {
        return mockResponse({
          DualCLIPLoader: {
            input: {
              required: {
                clip_name1: [['clip_l.safetensors', 't5xxl_fp16.safetensors', 't5xxl_fp8.safetensors']],
              },
            },
          },
        });
      }
      if (url.includes('/object_info/VAELoader')) {
        return mockResponse({
          VAELoader: {
            input: {
              required: {
                vae_name: [['ae.safetensors', 'sdxl_vae.safetensors']],
              },
            },
          },
        });
      }
      return mockErrorResponse();
    });

    const support = await discoverSupportFiles('http://localhost:8188');

    expect(support.clipFiles).toEqual(['clip_l.safetensors', 't5xxl_fp16.safetensors', 't5xxl_fp8.safetensors']);
    expect(support.vaeFiles).toEqual(['ae.safetensors', 'sdxl_vae.safetensors']);
  });

  it('returns empty arrays when nodes are not available', async () => {
    vi.mocked(httpRequest).mockResolvedValue(mockErrorResponse());

    const support = await discoverSupportFiles('http://localhost:8188');

    expect(support.clipFiles).toEqual([]);
    expect(support.vaeFiles).toEqual([]);
  });

  it('handles server errors gracefully', async () => {
    vi.mocked(httpRequest).mockRejectedValue(new Error('connection refused'));

    const support = await discoverSupportFiles('http://localhost:8188');

    expect(support.clipFiles).toEqual([]);
    expect(support.vaeFiles).toEqual([]);
  });
});

describe('discoverModels — edge cases', () => {
  it('handles empty model lists', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      if (url.includes('/object_info/')) {
        const node = url.includes('Checkpoint') ? 'CheckpointLoaderSimple' : 'UNETLoader';
        const field = url.includes('Checkpoint') ? 'ckpt_name' : 'unet_name';
        return mockResponse({ [node]: { input: { required: { [field]: [[]] } } } });
      }
      return mockResponse([]);
    });

    const models = await discoverModels('http://localhost:8188');
    expect(models).toEqual([]);
  });

  it('handles server errors gracefully', async () => {
    vi.mocked(httpRequest).mockRejectedValue(new Error('connection refused'));

    const models = await discoverModels('http://localhost:8188');
    expect(models).toEqual([]);
  });

  it('generates correct IDs from filenames', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      if (url.includes('/object_info/CheckpointLoaderSimple')) {
        return mockResponse({
          CheckpointLoaderSimple: {
            input: { required: { ckpt_name: [['my-custom_model-v2.1.safetensors']] } },
          },
        });
      }
      if (url.includes('/object_info/UNETLoader')) {
        return mockResponse({ UNETLoader: { input: { required: { unet_name: [[]] } } } });
      }
      return mockErrorResponse();
    });

    const models = await discoverModels('http://localhost:8188');
    expect(models.length).toBe(1);
    expect(models[0].id).toBe('my_custom_model_v2_1');
    expect(models[0].displayName).toContain('Custom');
  });

  it('assigns correct default params for lightning models', async () => {
    vi.mocked(httpRequest).mockImplementation(async (url: string) => {
      if (url.includes('/object_info/CheckpointLoaderSimple')) {
        return mockResponse({
          CheckpointLoaderSimple: {
            input: { required: { ckpt_name: [['sdxl_lightning_4step.safetensors']] } },
          },
        });
      }
      if (url.includes('/object_info/UNETLoader')) {
        return mockResponse({ UNETLoader: { input: { required: { unet_name: [[]] } } } });
      }
      return mockErrorResponse();
    });

    const models = await discoverModels('http://localhost:8188');
    const params = models[0].params as Record<string, unknown>;
    expect(params['steps']).toBe(4);
    expect(params['cfg']).toBe(1.0);
    expect(models[0].type).toBe('checkpoint');
  });
});
