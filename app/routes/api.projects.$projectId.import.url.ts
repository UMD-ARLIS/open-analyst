import { createDocument } from '~/lib/db/queries/documents.server';
import { refreshDocumentKnowledgeIndex } from '~/lib/knowledge-index.server';
import { requireProjectApiAccess } from '~/lib/project-access.server';
import { parseJsonBody } from '~/lib/request-utils';
import { tavilyExtract } from '~/lib/tavily.server';
import type { Route } from './+types/api.projects.$projectId.import.url';

function validateHttpUrl(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) throw new Error('url is required');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are supported');
  }
  return parsed.toString();
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  await requireProjectApiAccess(request, params.projectId);
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const url = validateHttpUrl(body.url);

  // Try Tavily Extract first for clean content extraction
  let title = String(body.title || '').trim();
  let content: string;
  let extractionMethod: string;

  const extracted = await tavilyExtract(url);
  if (extracted && extracted.content) {
    content = extracted.content;
    if (!title) title = extracted.title;
    extractionMethod = 'tavily';
  } else {
    // Fallback: raw fetch + HTML strip
    const fetchRes = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'open-analyst-headless' },
    });
    const raw = await fetchRes.text();
    const contentType = fetchRes.headers.get('content-type') || '';
    content = contentType.includes('html') ? stripHtml(raw) : raw;
    if (!title) {
      const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
      title = match ? match[1].replace(/\s+/g, ' ').trim() : new URL(url).hostname;
    }
    extractionMethod = 'fallback';
  }

  const document = await createDocument(params.projectId, {
    collectionId: body.collectionId,
    title: title || url,
    sourceType: 'url',
    sourceUri: url,
    content,
    metadata: { extractionMethod },
  });
  const indexed = await refreshDocumentKnowledgeIndex(params.projectId, document.id);
  return Response.json({ document: indexed || document }, { status: 201 });
}
