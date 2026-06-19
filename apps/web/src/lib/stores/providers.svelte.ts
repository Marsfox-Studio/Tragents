import type { ProviderConfig } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';
import { decryptString, encryptString } from '../storage/keystore.js';

// Storage shape — same as ProviderConfig but apiKey is an encrypted byte blob.
interface StoredProvider extends Omit<ProviderConfig, 'apiKey'> {
  apiKey: Uint8Array;
}

class ProvidersStore {
  list = $state<ProviderConfig[]>([]);
  loaded = $state(false);

  async load() {
    try {
      const stored = await idbGetAll<StoredProvider>(STORES.providers);
      this.list = await Promise.all(
        stored.map(async (p) => ({
          ...p,
          apiKey: await decryptString(p.apiKey),
        })),
      );
    } catch (err) {
      console.error('Failed to load providers', err);
    } finally {
      this.loaded = true;
    }
  }

  async add(input: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderConfig> {
    const now = Date.now();
    const config: ProviderConfig = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const encrypted: StoredProvider = { ...config, apiKey: await encryptString(config.apiKey) };
    await idbPut(STORES.providers, encrypted);
    this.list = [...this.list, config];
    return config;
  }

  async update(id: string, patch: Partial<Omit<ProviderConfig, 'id' | 'createdAt'>>) {
    const idx = this.list.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error(`Provider ${id} not found`);
    const existing = this.list[idx]!;
    const updated: ProviderConfig = { ...existing, ...patch, updatedAt: Date.now() };
    const encrypted: StoredProvider = { ...updated, apiKey: await encryptString(updated.apiKey) };
    await idbPut(STORES.providers, encrypted);
    this.list = [...this.list.slice(0, idx), updated, ...this.list.slice(idx + 1)];
    return updated;
  }

  async remove(id: string) {
    await idbDelete(STORES.providers, id);
    this.list = this.list.filter((p) => p.id !== id);
  }

  byId(id: string): ProviderConfig | undefined {
    return this.list.find((p) => p.id === id);
  }
}

export const providers = new ProvidersStore();
