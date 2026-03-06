import { describe, it, expect } from 'vitest';
import { buildSdxlWorkflow, buildFluxWorkflow } from '../src/backends/comfyui/workflows.js';

const sdxlParams = {
  checkpoint: 'sdxl_lightning_4step.safetensors',
  positivePrompt: 'a beautiful scene',
  negativePrompt: 'ugly, blurry',
  width: 1024,
  height: 1024,
  seed: 42,
  steps: 4,
  cfg: 1.0,
  sampler: 'euler',
  scheduler: 'sgm_uniform',
};

const fluxParams = {
  unet: 'flux1-schnell.safetensors',
  positivePrompt: 'a cyberpunk city',
  width: 1344,
  height: 768,
  seed: 99,
  steps: 4,
  cfg: 1.0,
  sampler: 'euler',
  scheduler: 'simple',
};

describe('buildSdxlWorkflow', () => {
  it('produces a valid workflow with all required nodes', () => {
    const wf = buildSdxlWorkflow(sdxlParams);
    expect(Object.keys(wf).sort()).toEqual(
      ['ckpt', 'decode', 'ksamp', 'latent', 'neg', 'pos', 'save'],
    );
  });

  it('passes all parameters into the correct nodes', () => {
    const wf = buildSdxlWorkflow(sdxlParams) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    expect(wf['ckpt'].class_type).toBe('CheckpointLoaderSimple');
    expect(wf['ckpt'].inputs['ckpt_name']).toBe(sdxlParams.checkpoint);

    expect(wf['pos'].inputs['text']).toBe(sdxlParams.positivePrompt);
    expect(wf['neg'].inputs['text']).toBe(sdxlParams.negativePrompt);

    expect(wf['latent'].inputs['width']).toBe(sdxlParams.width);
    expect(wf['latent'].inputs['height']).toBe(sdxlParams.height);

    const ksamp = wf['ksamp'].inputs;
    expect(ksamp['seed']).toBe(sdxlParams.seed);
    expect(ksamp['steps']).toBe(sdxlParams.steps);
    expect(ksamp['cfg']).toBe(sdxlParams.cfg);
    expect(ksamp['sampler_name']).toBe(sdxlParams.sampler);
    expect(ksamp['scheduler']).toBe(sdxlParams.scheduler);
    expect(ksamp['denoise']).toBe(1.0);
  });
});

describe('buildFluxWorkflow', () => {
  it('produces a valid workflow with all required nodes', () => {
    const wf = buildFluxWorkflow(fluxParams);
    expect(Object.keys(wf).sort()).toEqual(
      ['clip', 'decode', 'ksamp', 'latent', 'neg', 'pos', 'save', 'unet', 'vae'],
    );
  });

  it('passes all parameters into the correct nodes', () => {
    const wf = buildFluxWorkflow(fluxParams) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    expect(wf['unet'].class_type).toBe('UNETLoader');
    expect(wf['unet'].inputs['unet_name']).toBe(fluxParams.unet);

    expect(wf['clip'].inputs['clip_name1']).toBe('clip_l.safetensors');
    expect(wf['clip'].inputs['clip_name2']).toBe('t5xxl_fp16.safetensors');

    expect(wf['pos'].inputs['text']).toBe(fluxParams.positivePrompt);
    expect(wf['neg'].inputs['text']).toBe(''); // Flux ignores negative

    expect(wf['latent'].inputs['width']).toBe(fluxParams.width);
    expect(wf['latent'].inputs['height']).toBe(fluxParams.height);

    const ksamp = wf['ksamp'].inputs;
    expect(ksamp['seed']).toBe(fluxParams.seed);
    expect(ksamp['steps']).toBe(fluxParams.steps);
    expect(ksamp['cfg']).toBe(fluxParams.cfg);
    expect(ksamp['sampler_name']).toBe(fluxParams.sampler);
    expect(ksamp['scheduler']).toBe(fluxParams.scheduler);
  });
});
