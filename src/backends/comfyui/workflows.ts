/** Workflow builders for ComfyUI — SDXL and Flux models. */

export type Workflow = Record<string, unknown>;

export interface SdxlWorkflowParams {
  checkpoint: string;
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
}

export interface FluxWorkflowParams {
  unet: string;
  positivePrompt: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  clipName1?: string;
  clipName2?: string;
  vaeName?: string;
}

/** Build an SDXL checkpoint-based workflow. */
export function buildSdxlWorkflow(params: SdxlWorkflowParams): Workflow {
  return {
    ckpt: {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: params.checkpoint },
    },
    pos: {
      class_type: 'CLIPTextEncode',
      inputs: { text: params.positivePrompt, clip: ['ckpt', 1] },
    },
    neg: {
      class_type: 'CLIPTextEncode',
      inputs: { text: params.negativePrompt, clip: ['ckpt', 1] },
    },
    latent: {
      class_type: 'EmptyLatentImage',
      inputs: { width: params.width, height: params.height, batch_size: 1 },
    },
    ksamp: {
      class_type: 'KSampler',
      inputs: {
        model: ['ckpt', 0],
        positive: ['pos', 0],
        negative: ['neg', 0],
        latent_image: ['latent', 0],
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: params.sampler,
        scheduler: params.scheduler,
        denoise: 1.0,
      },
    },
    decode: {
      class_type: 'VAEDecode',
      inputs: { samples: ['ksamp', 0], vae: ['ckpt', 2] },
    },
    save: {
      class_type: 'SaveImage',
      inputs: { images: ['decode', 0], filename_prefix: 'claude_vision' },
    },
  };
}

/** Build a Flux UNET-based workflow. */
export function buildFluxWorkflow(params: FluxWorkflowParams): Workflow {
  return {
    unet: {
      class_type: 'UNETLoader',
      inputs: { unet_name: params.unet, weight_dtype: 'default' },
    },
    clip: {
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: params.clipName1 ?? 'clip_l.safetensors',
        clip_name2: params.clipName2 ?? 't5xxl_fp16.safetensors',
        type: 'flux',
      },
    },
    vae: {
      class_type: 'VAELoader',
      inputs: { vae_name: params.vaeName ?? 'ae.safetensors' },
    },
    pos: {
      class_type: 'CLIPTextEncode',
      inputs: { text: params.positivePrompt, clip: ['clip', 0] },
    },
    neg: {
      class_type: 'CLIPTextEncode',
      inputs: { text: '', clip: ['clip', 0] },
    },
    latent: {
      class_type: 'EmptyLatentImage',
      inputs: { width: params.width, height: params.height, batch_size: 1 },
    },
    ksamp: {
      class_type: 'KSampler',
      inputs: {
        model: ['unet', 0],
        positive: ['pos', 0],
        negative: ['neg', 0],
        latent_image: ['latent', 0],
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: params.sampler,
        scheduler: params.scheduler,
        denoise: 1.0,
      },
    },
    decode: {
      class_type: 'VAEDecode',
      inputs: { samples: ['ksamp', 0], vae: ['vae', 0] },
    },
    save: {
      class_type: 'SaveImage',
      inputs: { images: ['decode', 0], filename_prefix: 'claude_vision' },
    },
  };
}
