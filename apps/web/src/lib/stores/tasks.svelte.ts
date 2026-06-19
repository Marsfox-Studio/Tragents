import type { TranslationMode } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';
import type { DiscussionTurn } from '../components/DiscussionStream.svelte';

/**
 * Persisted translation task — the live state of one running or finished
 * non-PTP translation. Keyed by `id` (one slot per project, plus a "free"
 * slot for projectless translations). Survives reload so the user never
 * loses their work when the page refreshes.
 *
 * PTP-mode translations live on Project.ptpRows (already persisted), so this
 * store only tracks the full-screen task view.
 */
export interface PersistedTask {
  id: string;
  projectId: string | null;
  input: string;
  output: string;
  error: string | null;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  mode: TranslationMode;
  resolvedMode?: Exclude<TranslationMode, 'auto'>;
  source: string;
  target: string;
  phase?: 'chunk' | 'parse' | 'summarize' | 'translate' | 'review' | 'consistency' | 'assemble';
  progress?: { current: number; total: number };
  meta?: { mode: string; pipelineName: string; agentCount: number; ms: number };
  discussionEnabled: boolean;
  discussion: DiscussionTurn[];
  startedAt: number;
  updatedAt: number;
}

export const FREE_TASK_ID = '__free__';

export function taskIdFor(projectId: string | undefined | null): string {
  return projectId ?? FREE_TASK_ID;
}

class TasksStore {
  list = $state<PersistedTask[]>([]);
  loaded = $state(false);

  async load() {
    try {
      this.list = await idbGetAll<PersistedTask>(STORES.tasks);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      this.loaded = true;
    }
  }

  byId(id: string): PersistedTask | undefined {
    return this.list.find((t) => t.id === id);
  }

  forProject(projectId: string | undefined | null): PersistedTask | undefined {
    return this.byId(taskIdFor(projectId));
  }

  /**
   * Write the task to memory and IDB. Optimised for high-frequency calls:
   * the in-memory list is replaced synchronously so reactive consumers see
   * the new value, while the IDB write is fire-and-forget (errors logged).
   */
  upsert(task: PersistedTask): void {
    const idx = this.list.findIndex((t) => t.id === task.id);
    if (idx < 0) this.list = [...this.list, task];
    else this.list = [...this.list.slice(0, idx), task, ...this.list.slice(idx + 1)];
    void idbPut(STORES.tasks, $state.snapshot(task)).catch((err) =>
      console.error('Failed to persist task', err),
    );
  }

  async remove(id: string) {
    this.list = this.list.filter((t) => t.id !== id);
    try {
      await idbDelete(STORES.tasks, id);
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  }

  /**
   * Mark every task that was still 'running' when the tab closed as
   * 'cancelled'. Run once on app boot — there's no way to resume a stream
   * across reloads, so a running task left in IDB is by definition stale.
   */
  reconcileAfterReload(): void {
    let dirty = false;
    const next: PersistedTask[] = [];
    for (const t of this.list) {
      if (t.status === 'running') {
        const fixed: PersistedTask = {
          ...t,
          status: 'cancelled',
          error: t.error ?? 'interrupted (page reloaded)',
          updatedAt: Date.now(),
        };
        next.push(fixed);
        void idbPut(STORES.tasks, fixed).catch(() => {});
        dirty = true;
      } else {
        next.push(t);
      }
    }
    if (dirty) this.list = next;
  }
}

export const tasks = new TasksStore();
