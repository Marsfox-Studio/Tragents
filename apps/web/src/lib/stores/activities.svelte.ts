import type { ActivityRecord } from '@tragents/shared';
import { STORES, idbClear, idbDelete, idbGetAll, idbPut } from '../storage/db.js';

class ActivitiesStore {
  list = $state<ActivityRecord[]>([]);
  loaded = $state(false);

  async load() {
    try {
      const rows = await idbGetAll<ActivityRecord>(STORES.activities);
      this.list = rows.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      console.error('Failed to load activity log', err);
    } finally {
      this.loaded = true;
    }
  }

  recent = $derived([...this.list].sort((a, b) => b.createdAt - a.createdAt));

  record(entry: Omit<ActivityRecord, 'id' | 'createdAt'>): void {
    const now = Date.now();
    const row: ActivityRecord = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `activity-${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      ...entry,
    };
    this.list = [row, ...this.list].slice(0, 500);
    void idbPut(STORES.activities, $state.snapshot(row)).catch((err) =>
      console.error('Failed to persist activity', err),
    );
  }

  async clear() {
    this.list = [];
    await idbClear(STORES.activities);
  }

  async removeForProject(projectId: string) {
    const rows = this.list.filter((row) => row.projectId === projectId);
    await Promise.all(rows.map((row) => idbDelete(STORES.activities, row.id)));
    this.list = this.list.filter((row) => row.projectId !== projectId);
  }
}

export const activities = new ActivitiesStore();
