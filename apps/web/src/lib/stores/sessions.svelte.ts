import type { ChatMessage, ChatSession } from '@tragents/shared';
import { STORES, idbDelete, idbGetAll, idbPut } from '../storage/db.js';

class SessionsStore {
  list = $state<ChatSession[]>([]);
  loaded = $state(false);

  async load() {
    try {
      this.list = await idbGetAll<ChatSession>(STORES.sessions);
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      this.loaded = true;
    }
  }

  byId(id: string): ChatSession | undefined {
    return this.list.find((s) => s.id === id);
  }

  forProject(projectId: string | undefined): ChatSession[] {
    return this.list
      .filter((s) => (projectId ? s.projectId === projectId : s.projectId === undefined))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  recent = $derived([...this.list].sort((a, b) => b.updatedAt - a.updatedAt));

  /** Resolve the most recent session for a project, or undefined if none. */
  latestFor(projectId: string | undefined): ChatSession | undefined {
    return this.forProject(projectId)[0];
  }

  async create(projectId?: string, title = ''): Promise<ChatSession> {
    const now = Date.now();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      projectId,
      title: title || 'New chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await idbPut(STORES.sessions, session);
    this.list = [...this.list, session];
    return session;
  }

  async rename(id: string, title: string) {
    const idx = this.list.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const updated = { ...this.list[idx]!, title, updatedAt: Date.now() };
    await idbPut(STORES.sessions, updated);
    this.list = [...this.list.slice(0, idx), updated, ...this.list.slice(idx + 1)];
  }

  async delete(id: string) {
    await idbDelete(STORES.sessions, id);
    this.list = this.list.filter((s) => s.id !== id);
  }

  /**
   * Push a new message into a session. If this is the first user message,
   * also seed the session title from its leading words.
   */
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const idx = this.list.findIndex((s) => s.id === sessionId);
    if (idx < 0) return;
    const session = this.list[idx]!;
    let title = session.title;
    if (
      (session.title === 'New chat' || session.title === '') &&
      message.role === 'user' &&
      message.text
    ) {
      title = message.text.split('\n')[0]!.slice(0, 60).trim();
    }
    const updated: ChatSession = {
      ...session,
      title,
      messages: [...session.messages, message],
      updatedAt: Date.now(),
    };
    this.list = [...this.list.slice(0, idx), updated, ...this.list.slice(idx + 1)];
    await idbPut(STORES.sessions, updated);
  }

  /**
   * Update an existing message. Streaming-friendly: pass `skipPersist: true`
   * to mutate the in-memory state without writing to IDB on every delta.
   * The caller should call `persist(sessionId)` once after streaming finishes.
   */
  updateMessage(
    sessionId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
    options: { skipPersist?: boolean } = {},
  ): Promise<void> | void {
    const idx = this.list.findIndex((s) => s.id === sessionId);
    if (idx < 0) return;
    const session = this.list[idx]!;
    const messages = session.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m));
    const updated: ChatSession = { ...session, messages, updatedAt: Date.now() };
    this.list = [...this.list.slice(0, idx), updated, ...this.list.slice(idx + 1)];
    if (options.skipPersist) return;
    return idbPut(STORES.sessions, updated).then(() => undefined);
  }

  async persist(sessionId: string): Promise<void> {
    const s = this.byId(sessionId);
    if (s) await idbPut(STORES.sessions, s);
  }
}

export const sessions = new SessionsStore();
