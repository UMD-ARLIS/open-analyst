import { timingSafeEqual } from 'node:crypto';

function resolveInternalApiKey(): string {
  return String(process.env.OPEN_ANALYST_INTERNAL_API_KEY || '').trim();
}

function safeCompare(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isTrustedInternalRequest(request: Request): boolean {
  const configured = resolveInternalApiKey();
  const supplied = String(request.headers.get('x-open-analyst-internal-key') || '').trim();
  if (!configured || !supplied) return false;
  return safeCompare(supplied, configured);
}
