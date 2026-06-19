import type { ModelDescriptor, ProviderKind } from '@tragents/shared';

/**
 * Built-in model catalog. User can still type arbitrary model IDs in the
 * provider settings — these are just suggestions surfaced in the picker.
 *
 * Pricing intentionally omitted: it changes frequently and is per-provider.
 * Fetch live pricing later if useful.
 */
export const BUILT_IN_MODELS: Record<ProviderKind, ModelDescriptor[]> = {
  anthropic: [
    {
      id: 'claude-opus-4-7',
      label: 'Claude Opus 4.7',
      providerKind: 'anthropic',
      context: 200000,
      capabilities: { streaming: true, thinking: true, cache: true },
    },
    {
      id: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      providerKind: 'anthropic',
      context: 200000,
      capabilities: { streaming: true, cache: true },
    },
    {
      id: 'claude-haiku-4-5',
      label: 'Claude Haiku 4.5',
      providerKind: 'anthropic',
      context: 200000,
      capabilities: { streaming: true, cache: true },
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      providerKind: 'openai',
      context: 128000,
      capabilities: { streaming: true },
    },
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      providerKind: 'openai',
      context: 128000,
      capabilities: { streaming: true },
    },
    {
      id: 'o1',
      label: 'o1',
      providerKind: 'openai',
      context: 200000,
      capabilities: { thinking: true },
    },
    {
      id: 'o3-mini',
      label: 'o3-mini',
      providerKind: 'openai',
      context: 200000,
      capabilities: { streaming: true, thinking: true },
    },
  ],
  'openai-compat': [
    { id: 'deepseek-chat', label: 'DeepSeek V3', providerKind: 'openai-compat' },
    {
      id: 'deepseek-reasoner',
      label: 'DeepSeek R1',
      providerKind: 'openai-compat',
      capabilities: { thinking: true },
    },
    { id: 'moonshot-v1-128k', label: 'Moonshot v1 (128k)', providerKind: 'openai-compat' },
    { id: 'qwen-max', label: 'Qwen Max', providerKind: 'openai-compat' },
    { id: 'llama-3.3-70b-instruct', label: 'Llama 3.3 70B', providerKind: 'openai-compat' },
  ],
};

/** Convenience hints for common OpenAI-compatible providers. */
export interface CompatPreset {
  id: string;
  label: string;
  baseURL: string;
  signupURL?: string;
  hint?: string;
}

export const COMPAT_PRESETS: readonly CompatPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    signupURL: 'https://platform.deepseek.com',
  },
  {
    id: 'moonshot',
    label: 'Moonshot (Kimi)',
    baseURL: 'https://api.moonshot.cn',
    signupURL: 'https://platform.moonshot.cn',
  },
  {
    id: 'qwen',
    label: 'Qwen (DashScope)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    signupURL: 'https://dashscope.console.aliyun.com',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api',
    signupURL: 'https://openrouter.ai',
    hint: 'Single key, 100+ models routed.',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseURL: 'https://api.groq.com/openai',
    signupURL: 'https://console.groq.com',
    hint: 'Very fast Llama and Mixtral.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseURL: 'http://localhost:11434',
    hint: 'Runs models on your machine. No API key needed.',
  },
];
