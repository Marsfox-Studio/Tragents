import type { ProviderConfig } from '@tragents/shared';
import type { Provider } from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

export function createProvider(config: ProviderConfig): Provider {
  switch (config.kind) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
    case 'openai-compat':
      return new OpenAIProvider(config);
    default: {
      const exhaustive: never = config.kind;
      throw new Error(`Unknown provider kind: ${String(exhaustive)}`);
    }
  }
}
