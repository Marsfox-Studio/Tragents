import type { Glossary, GlossaryEntry } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';

class GlossariesStore {
  list = $state<Glossary[]>([]);
  loaded = $state(false);

  async load() {
    try {
      this.list = await idbGetAll<Glossary>(STORES.glossaries);
    } catch (err) {
      console.error('Failed to load glossaries', err);
    } finally {
      this.loaded = true;
    }
  }

  byId(id: string): Glossary | undefined {
    return this.list.find((g) => g.id === id);
  }

  async create(name: string, projectId?: string): Promise<Glossary> {
    const now = Date.now();
    const g: Glossary = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `glossary-${now}`,
      name,
      projectId,
      entries: [],
      createdAt: now,
      updatedAt: now,
    };
    await idbPut(STORES.glossaries, g);
    this.list = [...this.list, g];
    return g;
  }

  async rename(id: string, name: string) {
    await this.patch(id, { name });
  }

  async addEntry(id: string, entry: GlossaryEntry) {
    const g = this.byId(id);
    if (!g) return;
    const entries = [
      ...g.entries.filter((e) => e.source !== entry.source),
      entry,
    ];
    await this.patch(id, { entries });
  }

  async removeEntry(id: string, source: string) {
    const g = this.byId(id);
    if (!g) return;
    const entries = g.entries.filter((e) => e.source !== source);
    await this.patch(id, { entries });
  }

  async updateEntry(id: string, source: string, patch: Partial<GlossaryEntry>) {
    const g = this.byId(id);
    if (!g) return;
    const entries = g.entries.map((e) => (e.source === source ? { ...e, ...patch } : e));
    await this.patch(id, { entries });
  }

  async delete(id: string) {
    await idbDelete(STORES.glossaries, id);
    this.list = this.list.filter((g) => g.id !== id);
  }

  async removeForProject(projectId: string) {
    const removed = this.list.filter((g) => g.projectId === projectId);
    for (const glossary of removed) await idbDelete(STORES.glossaries, glossary.id);
    this.list = this.list.filter((g) => g.projectId !== projectId);
  }

  private async patch(id: string, patch: Partial<Glossary>) {
    const idx = this.list.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const updated: Glossary = { ...this.list[idx]!, ...patch, updatedAt: Date.now() };
    await idbPut(STORES.glossaries, updated);
    this.list = [...this.list.slice(0, idx), updated, ...this.list.slice(idx + 1)];
  }
}

export const glossaries = new GlossariesStore();
