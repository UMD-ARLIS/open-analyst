import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the env module before importing the module under test.
// vi.mock is hoisted so the factory must not reference local variables.
// We use vi.hoisted() to create the shared state that both the mock factory
// and the test code can access.
// ---------------------------------------------------------------------------

const { mockEnv } = vi.hoisted(() => {
  return {
    mockEnv: { TAVILY_API_KEY: '' } as Record<string, string>,
  };
});

vi.mock('~/lib/env.server', () => ({
  env: new Proxy(mockEnv, {
    get: (_target, prop) => Reflect.get(mockEnv, prop),
  }),
}));

import { isTavilyConfigured, tavilyExtract } from '~/lib/tavily.server';

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
  mockEnv.TAVILY_API_KEY = '';
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
// isTavilyConfigured
// ---------------------------------------------------------------------------

describe('isTavilyConfigured', () => {
  it('returns false when TAVILY_API_KEY is empty', () => {
    mockEnv.TAVILY_API_KEY = '';
    expect(isTavilyConfigured()).toBe(false);
  });

  it('returns true when TAVILY_API_KEY is set', () => {
    mockEnv.TAVILY_API_KEY = 'tvly-test-key';
    expect(isTavilyConfigured()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tavilyExtract
// ---------------------------------------------------------------------------

describe('tavilyExtract', () => {
  it('returns content when API responds successfully', async () => {
    mockEnv.TAVILY_API_KEY = 'tvly-test-key';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            url: 'https://example.com/article',
            raw_content: '# Great Article\nThis is the full content of the article.',
          },
        ],
      })
    );

    const result = await tavilyExtract('https://example.com/article');

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://example.com/article');
    expect(result!.content).toContain('full content of the article');
    expect(result!.rawContentLength).toBeGreaterThan(0);
    expect(result!.title).toBe('Great Article');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when TAVILY_API_KEY is empty', async () => {
    mockEnv.TAVILY_API_KEY = '';

    const result = await tavilyExtract('https://example.com/article');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null on HTTP error', async () => {
    mockEnv.TAVILY_API_KEY = 'tvly-test-key';
    fetchMock.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );

    const result = await tavilyExtract('https://example.com/article');

    expect(result).toBeNull();
  });

  it('returns null on timeout (abort)', async () => {
    mockEnv.TAVILY_API_KEY = 'tvly-test-key';
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

    // Use fake timers to trigger the abort
    vi.useFakeTimers();
    const promise = tavilyExtract('https://example.com/slow');
    vi.advanceTimersByTime(31_000);
    const result = await promise;
    vi.useRealTimers();

    expect(result).toBeNull();
  });

  it('returns null when results array is empty', async () => {
    mockEnv.TAVILY_API_KEY = 'tvly-test-key';
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [] }));

    const result = await tavilyExtract('https://example.com/empty');

    expect(result).toBeNull();
  });
});
