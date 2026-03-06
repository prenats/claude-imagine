/** Core interfaces for the backend abstraction layer. */

import type { BuiltPrompt } from '../models.js';

/** A discovered model from the backend server. */
export interface DiscoveredModel {
  readonly id: string;
  readonly filename: string;
  readonly displayName: string;
  readonly type: 'checkpoint' | 'unet';
  readonly params: Readonly<Record<string, unknown>>;
}

/** The result of an image generation. */
export interface GenerationResult {
  readonly imageBytes: Uint8Array;
  readonly metadata: {
    readonly model: string;
    readonly elapsedMs: number;
  };
}

/** The contract every image generation backend must fulfill. */
export interface ImageBackend {
  readonly name: string;

  /** Probe a URL to check if this backend is running there. */
  detect(url: string): Promise<boolean>;

  /** Query the server for all installed models. */
  discoverModels(url: string): Promise<ReadonlyArray<DiscoveredModel>>;

  /** Generate an image. Backend handles workflow + API + retrieval. */
  generate(
    prompt: BuiltPrompt,
    model: DiscoveredModel,
    serverUrl: string,
  ): Promise<GenerationResult>;

  /** Check if the server is healthy. */
  checkHealth(url: string): Promise<boolean>;
}
