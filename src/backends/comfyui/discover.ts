/** Query a ComfyUI server for installed models. */

import { httpRequest } from './client.js';
import { getDefaultParams } from './defaults.js';
import type { DiscoveredModel } from '../types.js';

/**
 * Model folders that ComfyUI can serve.
 * Each entry maps a folder name to the model type we assign.
 */
const MODEL_FOLDERS: ReadonlyArray<{ folder: string; type: 'checkpoint' | 'unet' }> = [
  { folder: 'checkpoints', type: 'checkpoint' },
  { folder: 'diffusion_models', type: 'unet' },
  { folder: 'unet', type: 'unet' },
];

/**
 * Loader nodes in ComfyUI and which input field lists the models.
 * Used as the primary discovery method — these aggregate models from
 * all relevant folders automatically.
 */
const LOADER_NODES: ReadonlyArray<{
  node: string;
  inputField: string;
  type: 'checkpoint' | 'unet';
}> = [
  { node: 'CheckpointLoaderSimple', inputField: 'ckpt_name', type: 'checkpoint' },
  { node: 'UNETLoader', inputField: 'unet_name', type: 'unet' },
];

/**
 * Discover all installed models on a ComfyUI server.
 *
 * Primary: queries /object_info for loader nodes (CheckpointLoaderSimple,
 * UNETLoader) which list all models the node can actually load.
 *
 * Fallback: queries /models/{folder} for each known model folder.
 */
export async function discoverModels(url: string): Promise<DiscoveredModel[]> {
  // Try object_info-based discovery first (most accurate)
  const fromNodes = await discoverFromLoaderNodes(url);
  if (fromNodes.length > 0) return fromNodes;

  // Fallback: scan model folders directly
  return discoverFromFolders(url);
}

async function discoverFromLoaderNodes(url: string): Promise<DiscoveredModel[]> {
  const models: DiscoveredModel[] = [];
  const seen = new Set<string>();

  for (const { node, inputField, type } of LOADER_NODES) {
    const filenames = await fetchNodeModelList(url, node, inputField);
    for (const filename of filenames) {
      if (seen.has(filename)) continue;
      seen.add(filename);

      const id = filenameToId(filename);
      const defaults = getDefaultParams(filename, type);
      models.push({
        id,
        filename,
        displayName: filenameToDisplayName(filename),
        type,
        params: { ...defaults },

      });
    }
  }

  return models;
}

async function discoverFromFolders(url: string): Promise<DiscoveredModel[]> {
  const models: DiscoveredModel[] = [];
  const seen = new Set<string>();

  for (const { folder, type } of MODEL_FOLDERS) {
    const filenames = await fetchFolderModelList(url, folder);
    for (const filename of filenames) {
      if (seen.has(filename)) continue;
      seen.add(filename);

      const id = filenameToId(filename);
      const defaults = getDefaultParams(filename, type);
      models.push({
        id,
        filename,
        displayName: filenameToDisplayName(filename),
        type,
        params: { ...defaults },

      });
    }
  }

  return models;
}

/**
 * Query /object_info/{node} and extract the model list from the
 * input field's enum values.
 */
async function fetchNodeModelList(
  url: string,
  node: string,
  inputField: string,
): Promise<string[]> {
  try {
    const response = await httpRequest(`${url}/object_info/${node}`);
    if (!response.ok) return [];
    const data = (await response.json()) as Record<string, unknown>;

    const nodeInfo = data[node] as Record<string, unknown> | undefined;
    if (!nodeInfo) return [];

    const input = nodeInfo['input'] as Record<string, unknown> | undefined;
    if (!input) return [];

    const required = input['required'] as Record<string, unknown> | undefined;
    if (!required) return [];

    const field = required[inputField] as unknown[] | undefined;
    if (!field || !Array.isArray(field) || field.length === 0) return [];

    // The first element is the list of model names (string[])
    const modelList = field[0];
    if (Array.isArray(modelList)) {
      return modelList.filter((v): v is string => typeof v === 'string');
    }

    return [];
  } catch {
    return [];
  }
}

interface ComfyModelEntry {
  readonly name: string;
  readonly pathIndex?: number;
}

async function fetchFolderModelList(url: string, folder: string): Promise<string[]> {
  try {
    const response = await httpRequest(`${url}/models/${folder}`);
    if (!response.ok) return [];
    const data = await response.json();

    if (Array.isArray(data)) {
      return data.map((entry: string | ComfyModelEntry) =>
        typeof entry === 'string' ? entry : entry.name,
      );
    }
    return [];
  } catch {
    return [];
  }
}

/** Available support files (CLIP, VAE) on the server. */
export interface SupportFiles {
  readonly clipFiles: ReadonlyArray<string>;
  readonly vaeFiles: ReadonlyArray<string>;
}

/**
 * Discover available CLIP and VAE files on a ComfyUI server.
 * Used during setup so the user can select which files to use for UNET models.
 */
export async function discoverSupportFiles(url: string): Promise<SupportFiles> {
  const clipFiles = await fetchNodeModelList(url, 'DualCLIPLoader', 'clip_name1');
  const vaeFiles = await fetchNodeModelList(url, 'VAELoader', 'vae_name');

  return { clipFiles, vaeFiles };
}

function filenameToId(filename: string): string {
  return filename
    .replace(/\.safetensors$|\.ckpt$|\.pt$|\.bin$|\.gguf$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function filenameToDisplayName(filename: string): string {
  const base = filename.replace(/\.safetensors$|\.ckpt$|\.pt$|\.bin$|\.gguf$/, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
