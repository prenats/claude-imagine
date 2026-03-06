/** HTTP client for communicating with a ComfyUI server. */

import { ConnectionError, GenerationError, TimeoutError } from '../../errors.js';

export const POLL_INTERVAL = 1500; // ms
export const TIMEOUT = 180_000;    // ms

export async function httpRequest(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ConnectionError(`Request to ${url} timed out after 30s`);
    }
    throw new ConnectionError(`Cannot reach server at ${url}: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Queue a workflow and return the prompt_id. */
export async function queuePrompt(
  workflow: Record<string, unknown>,
  baseUrl: string,
): Promise<string> {
  const payload = JSON.stringify({ prompt: workflow });
  const response = await httpRequest(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  if (!response.ok) {
    throw new GenerationError(`Server returned status ${response.status}`);
  }

  const result = (await response.json()) as { prompt_id: string };
  return result.prompt_id;
}

/** Poll /history until the generation completes, then download and return image bytes. */
export async function waitForCompletion(
  promptId: string,
  baseUrl: string,
): Promise<Uint8Array> {
  const deadline = Date.now() + TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL));

    const historyResponse = await httpRequest(`${baseUrl}/history/${promptId}`);
    const history = (await historyResponse.json()) as Record<string, unknown>;

    if (!(promptId in history)) continue;

    const entry = history[promptId] as Record<string, unknown>;
    const status = (entry['status'] ?? {}) as Record<string, unknown>;

    if (status['status_str'] === 'error') {
      const msgs = status['messages'] as unknown[] | undefined;
      const detail = msgs?.length ? msgs.map(String).join('; ') : 'unknown error';
      throw new GenerationError(`Generation failed: ${detail}`);
    }

    const outputs = (entry['outputs'] ?? {}) as Record<string, unknown>;
    if (Object.keys(outputs).length === 0) continue;

    for (const nodeOutput of Object.values(outputs)) {
      const node = nodeOutput as Record<string, unknown>;
      if (!('images' in node)) continue;

      const images = node['images'] as Array<{
        filename: string;
        subfolder?: string;
        type: string;
      }>;
      const img = images[0];
      const { filename, subfolder = '', type: imgType } = img;
      const viewUrl =
        `${baseUrl}/view?filename=${encodeURIComponent(filename)}` +
        `&subfolder=${encodeURIComponent(subfolder)}` +
        `&type=${encodeURIComponent(imgType)}`;

      const viewResponse = await httpRequest(viewUrl);
      const buffer = await viewResponse.arrayBuffer();
      return new Uint8Array(buffer);
    }
  }

  throw new TimeoutError(
    `Generation ${promptId} did not complete within ${TIMEOUT / 1000}s. ` +
    'Try a faster image type (ICON, THUMBNAIL) or check the server.',
  );
}
