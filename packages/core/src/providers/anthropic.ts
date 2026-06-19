import type { ProviderKind } from '@tragents/shared';
import { BaseProvider } from './base.js';
import { parseSSE } from './sse.js';
import { ProviderError, type ChatChunk, type ChatRequest } from '../types.js';

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  message?: { usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider extends BaseProvider {
  readonly kind: ProviderKind = 'anthropic';

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const baseURL = this.config.baseURL ?? 'https://api.anthropic.com';
    const url = `${baseURL.replace(/\/$/, '')}/v1/messages`;

    // Anthropic puts system separately; messages are user/assistant only.
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
      stream: true,
    };
    if (req.system) body.system = req.system;
    if (typeof req.temperature === 'number') body.temperature = req.temperature;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        // Required to allow direct browser calls without a proxy.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new ProviderError(
        `Anthropic ${resp.status}: ${errBody.slice(0, 500)}`,
        resp.status,
        this.kind,
      );
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheRead = 0;
    let cacheWrite = 0;

    for await (const evt of parseSSE(resp, req.signal)) {
      if (evt.data === '[DONE]') {
        yield { done: true };
        continue;
      }
      let parsed: AnthropicStreamEvent;
      try {
        parsed = JSON.parse(evt.data) as AnthropicStreamEvent;
      } catch {
        continue;
      }

      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
        yield { delta: parsed.delta.text };
      } else if (parsed.type === 'message_start' && parsed.message?.usage) {
        inputTokens = parsed.message.usage.input_tokens ?? 0;
        cacheRead = parsed.message.usage.cache_read_input_tokens ?? 0;
        cacheWrite = parsed.message.usage.cache_creation_input_tokens ?? 0;
      } else if (parsed.type === 'message_delta' && parsed.usage) {
        outputTokens = parsed.usage.output_tokens ?? outputTokens;
      } else if (parsed.type === 'message_stop') {
        yield {
          usage: {
            inputTokens,
            outputTokens,
            cacheReadTokens: cacheRead,
            cacheWriteTokens: cacheWrite,
          },
          done: true,
        };
      }
    }
  }
}
