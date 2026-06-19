import type { ProviderConfig, ProviderKind } from '@tragents/shared';
import type { ChatChunk, ChatRequest, ChatResponse, Provider } from '../types.js';

export abstract class BaseProvider implements Provider {
  abstract readonly kind: ProviderKind;
  constructor(public readonly config: ProviderConfig) {}

  abstract stream(req: ChatRequest): AsyncIterable<ChatChunk>;

  async complete(req: ChatRequest): Promise<ChatResponse> {
    let text = '';
    let usage: ChatResponse['usage'];
    for await (const chunk of this.stream(req)) {
      if (chunk.delta) text += chunk.delta;
      if (chunk.usage) usage = chunk.usage;
    }
    return usage ? { text, usage } : { text };
  }
}
