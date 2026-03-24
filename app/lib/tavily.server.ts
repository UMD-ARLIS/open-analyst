import { env } from '~/lib/env.server';

const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract';
const EXTRACT_TIMEOUT_MS = 30_000;

interface TavilyExtractResult {
  url: string;
  title: string;
  content: string;
  rawContentLength: number;
}

export function isTavilyConfigured(): boolean {
  return Boolean(env.TAVILY_API_KEY);
}

/**
 * Extract clean content from a URL using Tavily Extract API.
 * Returns null if Tavily is not configured or extraction fails.
 */
export async function tavilyExtract(url: string): Promise<TavilyExtractResult | null> {
  if (!env.TAVILY_API_KEY) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_EXTRACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        urls: [url],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        url?: string;
        raw_content?: string;
      }>;
    };
    const results = data.results;
    if (!Array.isArray(results) || !results[0]) return null;
    const item = results[0];
    const rawContent = String(item.raw_content || '');
    // Extract a title from the first line or heading
    const titleMatch = /^#\s+(.+)$/m.exec(rawContent) || /^(.{1,200})$/m.exec(rawContent);
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    return {
      url: String(item.url || url),
      title,
      content: rawContent,
      rawContentLength: rawContent.length,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
