/** Shared server connectivity checks with optional Bearer auth and TLS. */

import './backends/comfyui/index.js';

import { getBackend } from './backends/registry.js';
import { configureServerTransport, buildAuthHeaders } from './server-transport.js';

export interface ServerConnectionOptions {
  readonly token?: string;
  readonly tlsInsecure?: boolean;
}

export function applyServerConnectionOptions(opts: ServerConnectionOptions): void {
  configureServerTransport({
    token: opts.token,
    tlsInsecure: opts.tlsInsecure,
  });
}

export async function checkComfyuiServer(
  url: string,
  opts: ServerConnectionOptions = {},
): Promise<boolean> {
  applyServerConnectionOptions(opts);
  const backend = getBackend('comfyui');
  if (!backend) return false;
  return backend.checkHealth(url);
}

export async function isServerReachable(
  url: string,
  opts: ServerConnectionOptions = {},
): Promise<boolean> {
  try {
    applyServerConnectionOptions(opts);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const headers = buildAuthHeaders();
    await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/** Prefer ComfyUI backend health; fall back to raw HTTP for non-ComfyUI URLs. */
export async function verifyServerConnection(
  url: string,
  opts: ServerConnectionOptions = {},
): Promise<boolean> {
  if (await checkComfyuiServer(url, opts)) return true;
  return isServerReachable(url, opts);
}
