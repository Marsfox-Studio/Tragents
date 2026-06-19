import type { Checkpoint, CheckpointSnapshot } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';

class CheckpointsStore {
  list = $state<Checkpoint[]>([]);
  loaded = $state(false);

  async load() {
    try {
      this.list = await idbGetAll<Checkpoint>(STORES.checkpoints);
    } catch (err) {
      console.error('Failed to load checkpoints', err);
    } finally {
      this.loaded = true;
    }
  }

  forProject(projectId: string): Checkpoint[] {
    return this.list
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async save(projectId: string, snapshot: CheckpointSnapshot, name?: string, auto = false): Promise<Checkpoint> {
    const now = Date.now();
    const cp: Checkpoint = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `cp-${now}`,
      projectId,
      name: name ?? new Date(now).toLocaleString(),
      timestamp: now,
      auto,
      snapshot,
    };
    await idbPut(STORES.checkpoints, cp);
    this.list = [...this.list, cp];
    return cp;
  }

  async remove(id: string) {
    await idbDelete(STORES.checkpoints, id);
    this.list = this.list.filter((c) => c.id !== id);
  }

  /** Drop all auto-checkpoints older than the most recent N for a project. */
  async pruneAuto(projectId: string, keep = 5) {
    const auto = this.list.filter((c) => c.projectId === projectId && c.auto);
    if (auto.length <= keep) return;
    const ordered = auto.sort((a, b) => b.timestamp - a.timestamp);
    const toRemove = ordered.slice(keep);
    for (const cp of toRemove) await idbDelete(STORES.checkpoints, cp.id);
    this.list = this.list.filter((c) => !toRemove.some((r) => r.id === c.id));
  }
}

export const checkpoints = new CheckpointsStore();
