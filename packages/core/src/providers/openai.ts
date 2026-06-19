import type { ProviderConfig, ProviderKind } from '@tragents/shared';
import { BaseProvider } from './base.js';
import { parseSSE } from './sse.js';
import { ProviderError, type ChatChunk, type ChatRequest } from '../types.js';

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

/**
 * Single class for both `openai` and `openai-compat` — wire format is identical,
 * only the baseURL differs. The factory passes the right kind via config.
 */
export class OpenAIProvider extends BaseProvider {
  readonly kind: ProviderKind;

  constructor(config: ProviderConfig) {
    super(config);
    this.kind = config.kind;
  }

  protected get baseURL(): string {
    if (this.config.baseURL) return this.config.baseURL.replace(/\/$/, '');
    return this.kind === 'openai' ? 'https://api.openai.com' : '';
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    if (!this.baseURL) {
      throw new ProviderError(
        'OpenAI-compatible provider requires a baseURL.',
        undefined,
        this.kind,
      );
    }
    const url = `${this.baseURL}/v1/chat/completions`;

    const messages = req.system
      ? [{ role: 'system' as const, content: req.system }, ...req.messages]
      : req.messages;

    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (typeof req.temperature === 'number') body.temperature = req.temperature;
    if (typeof req.maxTokens === 'number') body.max_tokens = req.maxTokens;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new ProviderError(
        `${this.kind} ${resp.status}: ${errBody.slice(0, 500)}`,
        resp.status,
        this.kind,
      );
    }

    for await (const evt of parseSSE(resp, req.signal)) {
      if (evt.data === '[DONE]') {
        yield { done: true };
        continue;
      }
      let parsed: OpenAIStreamChunk;
      try {
        parsed = JSON.parse(evt.data) as OpenAIStreamChunk;
      } catch {
        continue;
      }

      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) yield { delta };

      if (parsed.usage) {
        yield {
          usage: {
            inputTokens: parsed.usage.prompt_tokens ?? 0,
            outputTokens: parsed.usage.completion_tokens ?? 0,
            cacheReadTokens: parsed.usage.prompt_tokens_details?.cached_tokens,
          },
        };
      }
    }
  }
}
