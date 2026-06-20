import type { ProjectCorrectionMemory, ProjectMemory } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))].slice(0, 80);
}

function cleanRecentList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))].slice(0, 120);
}

function cleanHistory(values: ProjectCorrectionMemory[] | undefined): ProjectCorrectionMemory[] {
  return [...(values ?? [])]
    .filter((v) => v.lesson.trim())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 120);
}

class MemoriesStore {
  list = $state<ProjectMemory[]>([]);
  loaded = $state(false);
  private writes = new Map<string, Promise<unknown>>();

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

  private enqueue<T>(projectId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.writes.get(projectId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(action);
    const tracked = next.finally(() => {
      if (this.writes.get(projectId) === tracked) this.writes.delete(projectId);
    });
    this.writes.set(projectId, tracked);
    return next;
  }

  private async write(projectId: string, patch: Partial<Omit<ProjectMemory, 'projectId'>>) {
    const existing = this.byProject(projectId);
    const memory: ProjectMemory = {
      projectId,
      styleDecisions: cleanList(patch.styleDecisions ?? existing?.styleDecisions),
      terminologyDecisions: cleanList(
        patch.terminologyDecisions ?? existing?.terminologyDecisions,
      ),
      correctionDecisions: cleanRecentList(
        patch.correctionDecisions ?? existing?.correctionDecisions,
      ),
      correctionHistory: cleanHistory(
        patch.correctionHistory ?? existing?.correctionHistory,
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

  async upsert(projectId: string, patch: Partial<Omit<ProjectMemory, 'projectId'>>) {
    return await this.enqueue(projectId, () => this.write(projectId, patch));
  }

  async merge(projectId: string, patch: Partial<Omit<ProjectMemory, 'projectId'>>) {
    return await this.enqueue(projectId, async () => {
      const existing = this.byProject(projectId);
      return await this.write(projectId, {
        styleDecisions: cleanList([
          ...(existing?.styleDecisions ?? []),
          ...(patch.styleDecisions ?? []),
        ]),
        terminologyDecisions: cleanList([
          ...(existing?.terminologyDecisions ?? []),
          ...(patch.terminologyDecisions ?? []),
        ]),
        correctionDecisions: cleanRecentList([
          ...(patch.correctionDecisions ?? []),
          ...(existing?.correctionDecisions ?? []),
        ]),
        correctionHistory: cleanHistory([
          ...(existing?.correctionHistory ?? []),
          ...(patch.correctionHistory ?? []),
        ]),
        voiceNotes: cleanList([...(existing?.voiceNotes ?? []), ...(patch.voiceNotes ?? [])]),
        contextSummary: patch.contextSummary ?? existing?.contextSummary ?? '',
      });
    });
  }

  async appendCorrection(
    projectId: string,
    correction: Omit<ProjectCorrectionMemory, 'id' | 'createdAt'>,
  ) {
    const now = Date.now();
    const item: ProjectCorrectionMemory = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `correction-${now}`,
      createdAt: now,
      ...correction,
    };
    return await this.merge(projectId, {
      correctionDecisions: [correction.lesson],
      correctionHistory: [item],
    });
  }

  async remove(projectId: string) {
    await this.enqueue(projectId, async () => {
      await idbDelete(STORES.memories, projectId);
      this.list = this.list.filter((m) => m.projectId !== projectId);
    });
  }
}

export const memories = new MemoriesStore();
