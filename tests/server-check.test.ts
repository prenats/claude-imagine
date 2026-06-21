import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkComfyuiServer,
  isServerReachable,
  verifyServerConnection,
} from '../src/server-check.js';
import { resetServerTransportForTests } from '../src/server-transport.js';

describe('server-check', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetServerTransportForTests();
  });

  afterEach(() => {
    resetServerTransportForTests();
  });

  it('isServerReachable sends bearer token when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await isServerReachable('https://example.com', { token: 'secret' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer secret');
  });

  it('isServerReachable returns true on successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
    await expect(isServerReachable('http://localhost:8188')).resolves.toBe(true);
  });

  it('isServerReachable returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(isServerReachable('http://localhost:8188')).resolves.toBe(false);
  });

  it('verifyServerConnection falls back to raw HTTP when ComfyUI health fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
    await expect(verifyServerConnection('http://localhost:8188')).resolves.toBe(true);
  });

  it('checkComfyuiServer uses comfyui backend health', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await expect(checkComfyuiServer('http://localhost:8188')).resolves.toBe(true);
  });
});
