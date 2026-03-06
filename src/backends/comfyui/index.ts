/** ComfyUI backend implementation. */

import type { ImageBackend, DiscoveredModel, GenerationResult } from '../types.js';
import type { BuiltPrompt } from '../../models.js';
import { registerBackend } from '../registry.js';
import { httpRequest, queuePrompt, waitForCompletion } from './client.js';
import { buildSdxlWorkflow, buildFluxWorkflow } from './workflows.js';
import { discoverModels } from './discover.js';

export const comfyuiBackend: ImageBackend = {
  name: 'comfyui',

  async detect(url: string): Promise<boolean> {
    try {
      const response = await httpRequest(`${url}/object_info`);
      if (!response.ok) return false;
      const data = await response.json();
      // ComfyUI returns an object with node class names as keys
      return data !== null && typeof data === 'object' && 'KSampler' in (data as Record<string, unknown>);
    } catch {
      return false;
    }
  },

  async discoverModels(url: string): Promise<ReadonlyArray<DiscoveredModel>> {
    return discoverModels(url);
  },

  async generate(
    prompt: BuiltPrompt,
    model: DiscoveredModel,
    serverUrl: string,
  ): Promise<GenerationResult> {
    const params = model.params as Record<string, unknown>;
    const steps = (params['steps'] as number) ?? 20;
    const cfg = (params['cfg'] as number) ?? 1.0;
    const sampler = (params['sampler'] as string) ?? 'euler';
    const scheduler = (params['scheduler'] as string) ?? 'simple';

    const workflow =
      model.type === 'checkpoint'
        ? buildSdxlWorkflow({
            checkpoint: model.filename,
            positivePrompt: prompt.positive,
            negativePrompt: prompt.negative,
            width: prompt.width,
            height: prompt.height,
            seed: prompt.seed,
            steps,
            cfg,
            sampler,
            scheduler,
          })
        : buildFluxWorkflow({
            unet: model.filename,
            positivePrompt: prompt.positive,
            width: prompt.width,
            height: prompt.height,
            seed: prompt.seed,
            steps,
            cfg,
            sampler,
            scheduler,
            clipName1: params['clip_name1'] as string | undefined,
            clipName2: params['clip_name2'] as string | undefined,
            vaeName: params['vae_name'] as string | undefined,
          });

    const start = Date.now();
    const promptId = await queuePrompt(workflow, serverUrl);
    const imageBytes = await waitForCompletion(promptId, serverUrl);
    const elapsedMs = Date.now() - start;

    return {
      imageBytes,
      metadata: { model: model.id, elapsedMs },
    };
  },

  async checkHealth(url: string): Promise<boolean> {
    try {
      const response = await httpRequest(`${url}/object_info`);
      return response.ok;
    } catch {
      return false;
    }
  },
};

// Self-register
registerBackend(comfyuiBackend);
