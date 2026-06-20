import type { ProjectMemory } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))].slice(0, 80);
}

class MemoriesStore {
  list = $state<ProjectMemory[]>([]);
  loaded = $state(false);

  async load() {
    try {
      this.list = await idbGetAll<ProjectMemory>(STORES.memories);
    } catch (err) {
      console.error('Failed to load memories', err);
    } finally {
      this.loaded = true;
    }
  }

  byProject(projectId: string | undefined | null): ProjectMemory | undefined {
    if (!projectId) return undefined;
    return this.list.find((m) => m.projectId === projectId);
  }

  async upsert(projectId: string, patch: Partial<Omit<ProjectMemory, 'projectId'>>) {
    const existing = this.byProject(projectId);
    const memory: ProjectMemory = {
      projectId,
      styleDecisions: cleanList(patch.styleDecisions ?? existing?.styleDecisions),
      terminologyDecisions: cleanList(
        patch.terminologyDecisions ?? existing?.terminologyDecisions,
      ),
      contextSummary: patch.contextSummary ?? existing?.contextSummary ?? '',
      voiceNotes: cleanList(patch.voiceNotes ?? existing?.voiceNotes),
      updatedAt: Date.now(),
    };

    await idbPut(STORES.memories, memory);
    const idx = this.list.findIndex((m) => m.projectId === projectId);
    if (idx < 0) this.list = [...this.list, memory];
    else this.list = [...this.list.slice(0, idx), memory, ...this.list.slice(idx + 1)];
    return memory;
  }

  async merge(projectId: string, patch: Partial<Omit<ProjectMemory, 'projectId'>>) {
    const existing = this.byProject(projectId);
    return await this.upsert(projectId, {
      styleDecisions: cleanList([
        ...(existing?.styleDecisions ?? []),
        ...(patch.styleDecisions ?? []),
      ]),
      terminologyDecisions: cleanList([
        ...(existing?.terminologyDecisions ?? []),
        ...(patch.terminologyDecisions ?? []),
      ]),
      voiceNotes: cleanList([...(existing?.voiceNotes ?? []), ...(patch.voiceNotes ?? [])]),
      contextSummary: patch.contextSummary ?? existing?.contextSummary ?? '',
    });
  }

  async remove(projectId: string) {
    await idbDelete(STORES.memories, projectId);
    this.list = this.list.filter((m) => m.projectId !== projectId);
  }
}

export const memories = new MemoriesStore();
