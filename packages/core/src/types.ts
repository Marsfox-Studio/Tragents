import type { ProviderConfig, ProviderKind, ModelDescriptor } from '@tragents/shared';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface ChatChunk {
  delta?: string;
  usage?: UsageStats;
  done?: boolean;
}

export interface ChatResponse {
  text: string;
  usage?: UsageStats;
}

export interface Provider {
  readonly kind: ProviderKind;
  readonly config: ProviderConfig;
  stream(req: ChatRequest): AsyncIterable<ChatChunk>;
  complete(req: ChatRequest): Promise<ChatResponse>;
  listModels?(): Promise<ModelDescriptor[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly providerKind?: ProviderKind,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
