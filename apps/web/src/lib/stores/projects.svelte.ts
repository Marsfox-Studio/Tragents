import type { Project, PtpRow } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';

class ProjectsStore {
  list = $state<Project[]>([]);
  loaded = $state(false);

  async load() {
    try {
      this.list = await idbGetAll<Project>(STORES.projects);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      this.loaded = true;
    }
  }

  pinned = $derived(this.list.filter((p) => p.pinned));
  recent = $derived(
    [...this.list].sort((a, b) => b.updatedAt - a.updatedAt).filter((p) => !p.pinned),
  );
  all = $derived([...this.list].sort((a, b) => b.updatedAt - a.updatedAt));

  byId(id: string): Project | undefined {
    return this.list.find((p) => p.id === id);
  }

  async create(
    input: Pick<Project, 'name' | 'sourceLanguage' | 'targetLanguage'> & Partial<Project>,
  ): Promise<Project> {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    await idbPut(STORES.projects, project);
    this.list = [...this.list, project];
    return project;
  }

  async update(id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) {
    const idx = this.list.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error(`Project ${id} not found`);
    const existing = this.list[idx]!;
    const updated: Project = { ...existing, ...patch, updatedAt: Date.now() };
    await idbPut(STORES.projects, updated);
    this.list = [...this.list.slice(0, idx), updated, ...this.list.slice(idx + 1)];
    return updated;
  }

  async setPtpRows(id: string, rows: PtpRow[]) {
    await this.update(id, { ptpRows: rows });
  }

  async togglePin(id: string) {
    const p = this.list.find((p) => p.id === id);
    if (p) await this.update(id, { pinned: !p.pinned });
  }

  async remove(id: string) {
    await idbDelete(STORES.projects, id);
    this.list = this.list.filter((p) => p.id !== id);
  }
}

export const projects = new ProjectsStore();
