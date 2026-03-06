import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/backends/comfyui/client.js', () => ({
  httpRequest: vi.fn(),
  queuePrompt: vi.fn(),
  waitForCompletion: vi.fn(),
  POLL_INTERVAL: 1500,
  TIMEOUT: 180_000,
}));

import { comfyuiBackend } from '../../../src/backends/comfyui/index.js';
import { httpRequest, queuePrompt, waitForCompletion } from '../../../src/backends/comfyui/client.js';
import type { DiscoveredModel } from '../../../src/backends/types.js';
import type { BuiltPrompt } from '../../../src/models.js';

beforeEach(() => {
  vi.mocked(httpRequest).mockReset();
  vi.mocked(queuePrompt).mockReset();
  vi.mocked(waitForCompletion).mockReset();
});

describe('ComfyUI Backend', () => {
  it('has name "comfyui"', () => {
    expect(comfyuiBackend.name).toBe('comfyui');
  });

  describe('detect', () => {
    it('returns true when /object_info responds with KSampler', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        ok: true,
        json: async () => ({ KSampler: {}, CLIPTextEncode: {} }),
      } as Response);

      expect(await comfyuiBackend.detect('http://localhost:8188')).toBe(true);
    });

    it('returns false when /object_info returns non-ComfyUI response', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        ok: true,
        json: async () => ({ something: 'else' }),
      } as Response);

      expect(await comfyuiBackend.detect('http://localhost:8188')).toBe(false);
    });

    it('returns false when connection fails', async () => {
      vi.mocked(httpRequest).mockRejectedValue(new Error('connection refused'));

      expect(await comfyuiBackend.detect('http://localhost:8188')).toBe(false);
    });
  });

  describe('checkHealth', () => {
    it('returns true when server responds ok', async () => {
      vi.mocked(httpRequest).mockResolvedValue({ ok: true } as Response);
      expect(await comfyuiBackend.checkHealth('http://localhost:8188')).toBe(true);
    });

    it('returns false when server is down', async () => {
      vi.mocked(httpRequest).mockRejectedValue(new Error('down'));
      expect(await comfyuiBackend.checkHealth('http://localhost:8188')).toBe(false);
    });
  });

  describe('generate', () => {
    const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);

    it('builds SDXL workflow for checkpoint models', async () => {
      vi.mocked(queuePrompt).mockResolvedValue('p-123');
      vi.mocked(waitForCompletion).mockResolvedValue(PNG_BYTES);

      const model: DiscoveredModel = {
        id: 'sdxl_lightning',
        filename: 'sdxl_lightning_4step.safetensors',
        displayName: 'SDXL Lightning',
        type: 'checkpoint',
        params: { steps: 4, cfg: 1.0, sampler: 'euler', scheduler: 'sgm_uniform' },
      };

      const prompt: BuiltPrompt = {
        positive: 'a cat',
        negative: 'ugly',
        model: 'sdxl_lightning',
        width: 512,
        height: 512,
        seed: 42,
      };

      const result = await comfyuiBackend.generate(prompt, model, 'http://localhost:8188');
      expect(result.imageBytes).toBe(PNG_BYTES);
      expect(result.metadata.model).toBe('sdxl_lightning');

      const workflow = vi.mocked(queuePrompt).mock.calls[0][0] as Record<string, unknown>;
      expect(workflow).toHaveProperty('ckpt');
      expect(workflow).not.toHaveProperty('unet');
    });

    it('builds Flux workflow for unet models', async () => {
      vi.mocked(queuePrompt).mockResolvedValue('p-456');
      vi.mocked(waitForCompletion).mockResolvedValue(PNG_BYTES);

      const model: DiscoveredModel = {
        id: 'flux_schnell',
        filename: 'flux1-schnell.safetensors',
        displayName: 'Flux Schnell',
        type: 'unet',
        params: { steps: 4, cfg: 1.0, sampler: 'euler', scheduler: 'simple' },
      };

      const prompt: BuiltPrompt = {
        positive: 'a dog',
        negative: '',
        model: 'flux_schnell',
        width: 1024,
        height: 768,
        seed: 99,
      };

      const result = await comfyuiBackend.generate(prompt, model, 'http://localhost:8188');
      expect(result.imageBytes).toBe(PNG_BYTES);

      const workflow = vi.mocked(queuePrompt).mock.calls[0][0] as Record<string, unknown>;
      expect(workflow).toHaveProperty('unet');
      expect(workflow).not.toHaveProperty('ckpt');
    });
  });
});
