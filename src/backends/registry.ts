/** Backend registry — register backends by name, look them up later. */

import type { ImageBackend } from './types.js';

const backends = new Map<string, ImageBackend>();

/** Register a backend implementation. */
export function registerBackend(backend: ImageBackend): void {
  backends.set(backend.name, backend);
}

/** Get a backend by name. Returns undefined if not registered. */
export function getBackend(name: string): ImageBackend | undefined {
  return backends.get(name);
}

/** Get all registered backends. */
export function getRegisteredBackends(): ReadonlyArray<ImageBackend> {
  return [...backends.values()];
}
