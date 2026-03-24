import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * We test the internal `requestJson` helper indirectly through the exported
 * functions that call it, since `requestJson` is not exported. We use
 * `headlessGetModels` as a lightweight proxy for exercising requestJson.
 */
import { REQUEST_TIMEOUT_MS, headlessGetModels, headlessSaveConfig } from '~/lib/headless-api';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQUEST_TIMEOUT_MS', () => {
  it('is 30 seconds', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  });
});

describe('requestJson (via headlessGetModels)', () => {
  it('returns parsed JSON on success', async () => {
    const models = [{ id: 'gpt-4', name: 'GPT-4', supportsTools: true }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ models }));

    const result = await headlessGetModels();

    expect(result).toEqual(models);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/models');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('throws on non-ok status with error message from body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized access' }, 401));

    await expect(headlessGetModels()).rejects.toThrow('Unauthorized access');
  });

  it('throws with HTTP status when body has no error field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    await expect(headlessGetModels()).rejects.toThrow('HTTP 500');
  });

  it('abort signal cleans up on timeout', async () => {
    // Simulate a fetch that never resolves until aborted
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        })
    );

    // Use fake timers so we can control the timeout
    vi.useFakeTimers();

    const promise = headlessGetModels();

    // Advance past the timeout
    vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);

    await expect(promise).rejects.toThrow();

    vi.useRealTimers();
  });
});

describe('requestJson POST (via headlessSaveConfig)', () => {
  it('sends POST with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await headlessSaveConfig({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/config');
    expect(init.method).toBe('POST');
  });

  it('propagates message field from error body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Invalid config format' }, 400));

    await expect(headlessSaveConfig({})).rejects.toThrow('Invalid config format');
  });
});
