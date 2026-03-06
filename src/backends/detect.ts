/** Auto-detect which backend is running at a given URL. */

import { getRegisteredBackends } from './registry.js';
import type { ImageBackend } from './types.js';

/**
 * Probe URL against all registered backends.
 * Returns the first backend whose detect() succeeds, or null.
 */
export async function detectBackend(url: string): Promise<ImageBackend | null> {
  for (const backend of getRegisteredBackends()) {
    try {
      const matched = await backend.detect(url);
      if (matched) return backend;
    } catch {
      // This backend didn't match, try the next one
    }
  }
  return null;
}
