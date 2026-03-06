import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiscoveredModel } from '../src/backends/types.js';

// Mock the backends/detect module
vi.mock('../src/backends/detect.js', () => ({
  detectBackend: vi.fn(),
}));

// Mock the backend registration import (side-effect import)
vi.mock('../src/backends/comfyui/index.js', () => ({}));

import { detectAndDiscover, isSetupError, assignModelsByTier, buildConfig } from '../src/setup-core.js';
import { detectBackend } from '../src/backends/detect.js';

const mockDetectBackend = vi.mocked(detectBackend);

function makeModel(id: string): DiscoveredModel {
  return {
    id,
    filename: `${id}.safetensors`,
    displayName: id.replace(/_/g, ' '),
    type: 'checkpoint',
    params: {},
  };
}

describe('setup-core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectAndDiscover', () => {
    it('returns error when no backend detected', async () => {
      mockDetectBackend.mockResolvedValue(null);

      const result = await detectAndDiscover('http://localhost:8188');
      expect(isSetupError(result)).toBe(true);
      if (isSetupError(result)) {
        expect(result.error).toContain('No supported backend');
      }
    });

    it('returns error when model discovery fails', async () => {
      mockDetectBackend.mockResolvedValue({
        name: 'comfyui',
        detect: vi.fn(),
        discoverModels: vi.fn().mockRejectedValue(new Error('connection refused')),
        generate: vi.fn(),
        checkHealth: vi.fn(),
      });

      const result = await detectAndDiscover('http://localhost:8188');
      expect(isSetupError(result)).toBe(true);
      if (isSetupError(result)) {
        expect(result.error).toContain('Model discovery failed');
      }
    });

    it('returns discovered models and backend', async () => {
      const models = [makeModel('fast_model'), makeModel('slow_model')];
      mockDetectBackend.mockResolvedValue({
        name: 'comfyui',
        detect: vi.fn(),
        discoverModels: vi.fn().mockResolvedValue(models),
        generate: vi.fn(),
        checkHealth: vi.fn(),
      });

      const result = await detectAndDiscover('http://localhost:8188');
      expect(isSetupError(result)).toBe(false);
      if (!isSetupError(result)) {
        expect(result.backend).toBe('comfyui');
        expect(result.models).toHaveLength(2);
      }
    });
  });

  describe('assignModelsByTier', () => {
    it('assigns fast types to fast model', () => {
      const tierMap = { fast_model: 'fast' as const, slow_model: 'high' as const };
      const result = assignModelsByTier(tierMap);
      expect(result['ICON'].model).toBe('fast_model');
      expect(result['THUMBNAIL'].model).toBe('fast_model');
      expect(result['HERO'].model).toBe('slow_model');
      expect(result['LOGO'].model).toBe('slow_model');
    });

    it('falls back to first model for unmatched tiers', () => {
      const tierMap = { only_model: 'fast' as const };
      const result = assignModelsByTier(tierMap);
      expect(result['ICON'].model).toBe('only_model');
      expect(result['HERO'].model).toBe('only_model');
    });
  });

  describe('buildConfig', () => {
    it('builds config with tiers and image type assignments', () => {
      const models = [makeModel('fast_model'), makeModel('slow_model')];
      const tierMap = { fast_model: 'fast' as const, slow_model: 'high' as const };
      const config = buildConfig('comfyui', 'http://localhost:8188', models, tierMap);

      expect(config).toHaveProperty('backend', 'comfyui');
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('models');
      expect(config).toHaveProperty('imageTypes');

      const modelsConfig = config['models'] as Record<string, Record<string, unknown>>;
      expect(modelsConfig['fast_model']['tier']).toBe('fast');
      expect(modelsConfig['slow_model']['tier']).toBe('high');
    });
  });

  describe('isSetupError', () => {
    it('returns true for error objects', () => {
      expect(isSetupError({ error: 'something broke' })).toBe(true);
    });

    it('returns false for success objects', () => {
      expect(isSetupError({
        backend: 'comfyui',
        models: [],
        supportFiles: { clipFiles: [], vaeFiles: [] },
      })).toBe(false);
    });
  });
});
