import { describe, expect, it } from 'vitest';
import { applyChatStreamEvent, extractFinalAssistantText } from '~/lib/chat-stream';
import type { ContentBlock } from '~/lib/types';

describe('chat stream reducer', () => {
  it('builds structured blocks for status, tools, and final text', () => {
    let blocks: ContentBlock[] = [];

    blocks = applyChatStreamEvent(blocks, {
      type: 'status',
      status: 'running',
      phase: 'starting',
      text: 'Starting analysis',
    });
    blocks = applyChatStreamEvent(blocks, {
      type: 'tool_call_start',
      toolUseId: 'tool-1',
      toolName: 'web_fetch',
      toolInput: { url: 'https://example.com' },
    });
    blocks = applyChatStreamEvent(blocks, {
      type: 'tool_call_end',
      toolUseId: 'tool-1',
      toolName: 'web_fetch',
      toolOutput: 'Fetched example.com',
      toolStatus: 'completed',
    });
    blocks = applyChatStreamEvent(blocks, {
      type: 'text_delta',
      text: 'Final answer.',
    });

    expect(blocks).toEqual([
      {
        type: 'status',
        status: 'running',
        phase: 'starting',
        text: 'Starting analysis',
      },
      {
        type: 'tool_use',
        id: 'tool-1',
        name: 'web_fetch',
        input: { url: 'https://example.com' },
      },
      {
        type: 'tool_result',
        toolUseId: 'tool-1',
        content: 'Fetched example.com',
        isError: false,
      },
      {
        type: 'text',
        text: 'Final answer.',
      },
    ]);
    expect(extractFinalAssistantText(blocks)).toBe('Final answer.');
  });

  it('merges consecutive text deltas into one final text block', () => {
    let blocks: ContentBlock[] = [];
    blocks = applyChatStreamEvent(blocks, { type: 'text_delta', text: 'Hello' });
    blocks = applyChatStreamEvent(blocks, { type: 'text_delta', text: ' world' });

    expect(blocks).toEqual([{ type: 'text', text: 'Hello world' }]);
  });
});
