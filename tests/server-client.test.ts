import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionError, GenerationError, TimeoutError } from '../src/errors.js';
import {
  queuePrompt,
  waitForCompletion,
  POLL_INTERVAL,
  TIMEOUT,
} from '../src/backends/comfyui/client.js';
import { comfyuiBackend } from '../src/backends/comfyui/index.js';

const checkServer = (url: string) => comfyuiBackend.checkHealth(url);

const BASE_URL = 'http://test-server:8188';

function makeResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeBinaryResponse(data: Uint8Array, status = 200): Response {
  return new Response(data, {
    status,
    headers: { 'Content-Type': 'image/png' },
  });
}

describe('ConnectionError', () => {
  it('has correct name and message', () => {
    const err = new ConnectionError('test error');
    expect(err.name).toBe('ConnectionError');
    expect(err.message).toBe('test error');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('TimeoutError', () => {
  it('has correct name and message', () => {
    const err = new TimeoutError('timed out');
    expect(err.name).toBe('TimeoutError');
    expect(err.message).toBe('timed out');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('GenerationError', () => {
  it('has correct name and message', () => {
    const err = new GenerationError('gen failed');
    expect(err.name).toBe('GenerationError');
    expect(err.message).toBe('gen failed');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('Constants', () => {
  it('POLL_INTERVAL is 1500ms', () => {
    expect(POLL_INTERVAL).toBe(1500);
  });

  it('TIMEOUT is 180000ms', () => {
    expect(TIMEOUT).toBe(180_000);
  });
});

describe('queuePrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns prompt_id on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ prompt_id: 'abc-123' })));

    const id = await queuePrompt({ test: 'workflow' }, BASE_URL);
    expect(id).toBe('abc-123');
  });

  it('sends POST to /prompt with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse({ prompt_id: 'xyz' }));
    vi.stubGlobal('fetch', mockFetch);

    await queuePrompt({ node: 'data' }, BASE_URL);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/prompt`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt: { node: 'data' } }),
      }),
    );
  });

  it('throws GenerationError on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('error', { status: 500 })));

    await expect(queuePrompt({}, BASE_URL)).rejects.toThrow(GenerationError);
  });

  it('throws ConnectionError when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    await expect(queuePrompt({}, BASE_URL)).rejects.toThrow(ConnectionError);
  });

  it('throws ConnectionError with timeout message when request is aborted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      return Promise.reject(e);
    }));

    await expect(queuePrompt({}, BASE_URL)).rejects.toThrow(ConnectionError);
    await expect(queuePrompt({}, BASE_URL)).rejects.toThrow(/timed out/);
  });
});

describe('checkServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when server is reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const result = await checkServer(BASE_URL);
    expect(result).toBe(true);
  });

  it('returns false when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await checkServer(BASE_URL);
    expect(result).toBe(false);
  });

  it('calls /object_info endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    await checkServer(BASE_URL);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/object_info`,
      expect.anything(),
    );
  });
});

describe('waitForCompletion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns image bytes on success', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]); // PNG header
    const historyData = {
      'prompt-123': {
        status: { status_str: 'success' },
        outputs: {
          save: {
            images: [{ filename: 'test.png', subfolder: '', type: 'output' }],
          },
        },
      },
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(historyData))
      .mockResolvedValueOnce(makeBinaryResponse(imageBytes));

    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = waitForCompletion('prompt-123', BASE_URL);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result[0]).toBe(137); // PNG header byte
  });

  it('polls until prompt appears in history', async () => {
    const imageBytes = new Uint8Array([137]);
    const emptyHistory = {};
    const fullHistory = {
      'pid': {
        status: { status_str: 'success' },
        outputs: {
          save: { images: [{ filename: 'img.png', subfolder: '', type: 'output' }] },
        },
      },
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(emptyHistory))
      .mockResolvedValueOnce(makeResponse(fullHistory))
      .mockResolvedValueOnce(makeBinaryResponse(imageBytes));

    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = waitForCompletion('pid', BASE_URL);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 2 + 100);
    await resultPromise;

    const historyCalls = mockFetch.mock.calls.filter(c => String(c[0]).includes('/history'));
    expect(historyCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('skips outputs with no images key and continues polling', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]);
    const historyNoImages = {
      'pid': {
        status: { status_str: 'success' },
        outputs: { node1: { latents: [] } },
      },
    };
    const historyWithImages = {
      'pid': {
        status: { status_str: 'success' },
        outputs: { save: { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] } },
      },
    };

    const mockFetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(makeResponse(historyNoImages)))
      .mockImplementationOnce(() => Promise.resolve(makeResponse(historyWithImages)))
      .mockImplementationOnce(() => Promise.resolve(makeBinaryResponse(imageBytes)));

    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = waitForCompletion('pid', BASE_URL);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 2 + 200);

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('throws GenerationError on error status', async () => {
    const historyData = {
      'pid': {
        status: { status_str: 'error', messages: ['OOM error'] },
        outputs: {},
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(makeResponse(historyData))));

    const resultPromise = waitForCompletion('pid', BASE_URL);
    const caught = resultPromise.catch(e => e);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    const err = await caught;
    expect(err).toBeInstanceOf(GenerationError);
    expect(err.message).toContain('OOM error');
  });

  it('throws TimeoutError when deadline is exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(makeResponse({}))));

    const resultPromise = waitForCompletion('pid', BASE_URL);
    const caught = resultPromise.catch(e => e);

    await vi.advanceTimersByTimeAsync(TIMEOUT + POLL_INTERVAL * 2);

    const err = await caught;
    expect(err).toBeInstanceOf(TimeoutError);
  });

  it('uses "unknown error" when error status has no messages', async () => {
    const historyData = {
      'pid': {
        status: { status_str: 'error' },
        outputs: {},
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(makeResponse(historyData))));

    const resultPromise = waitForCompletion('pid', BASE_URL);
    const caught = resultPromise.catch(e => e);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    const err = await caught;
    expect(err).toBeInstanceOf(GenerationError);
    expect(err.message).toContain('unknown error');
  });

  it('uses "unknown error" when messages array is empty', async () => {
    const historyData = {
      'pid': {
        status: { status_str: 'error', messages: [] },
        outputs: {},
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(makeResponse(historyData))));

    const resultPromise = waitForCompletion('pid', BASE_URL);
    const caught = resultPromise.catch(e => e);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    const err = await caught;
    expect(err).toBeInstanceOf(GenerationError);
    expect(err.message).toContain('unknown error');
  });

  it('handles missing status key in history entry', async () => {
    const imageBytes = new Uint8Array([137, 80]);
    const historyData = {
      'pid': {
        outputs: {
          save: { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] },
        },
      },
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(historyData))
      .mockResolvedValueOnce(makeBinaryResponse(imageBytes));

    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = waitForCompletion('pid', BASE_URL);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('continues polling when outputs is empty', async () => {
    const imageBytes = new Uint8Array([137]);
    const emptyOutputs = {
      'pid': {
        status: { status_str: 'success' },
        outputs: {},
      },
    };
    const fullOutputs = {
      'pid': {
        status: { status_str: 'success' },
        outputs: {
          save: { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] },
        },
      },
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(emptyOutputs))
      .mockResolvedValueOnce(makeResponse(fullOutputs))
      .mockResolvedValueOnce(makeBinaryResponse(imageBytes));

    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = waitForCompletion('pid', BASE_URL);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 2 + 200);

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
