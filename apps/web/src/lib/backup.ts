import type {
  ActivityRecord,
  AppSettings,
  ChatSession,
  Checkpoint,
  Glossary,
  Project,
  ProjectMemory,
  ProviderConfig,
} from '@tragents/shared';
import { STORES, idbClear, idbDelete, idbGet, idbPut } from './storage/db.js';
import { decryptString, encryptString } from './storage/keystore.js';
import {
  activities,
  checkpoints,
  glossaries,
  memories,
  projects,
  providers,
  sessions,
  settings,
  tasks,
  type PersistedTask,
} from './stores';
import { SETTINGS_KEY } from './stores/settings.svelte.js';

type RedactedProvider = Omit<ProviderConfig, 'apiKey'> & { apiKey?: '' };

export interface LocalBackupPayload {
  kind: 'tragents.local-backup';
  version: 1;
  exportedAt: string;
  settings: AppSettings;
  providers: RedactedProvider[];
  projects: Project[];
  glossaries: Glossary[];
  checkpoints: Checkpoint[];
  sessions: ChatSession[];
  tasks: PersistedTask[];
  activities: ActivityRecord[];
  memories: ProjectMemory[];
}

export interface BackupImportSummary {
  projects: number;
  glossaries: number;
  checkpoints: number;
  sessions: number;
  tasks: number;
  activities: number;
  memories: number;
  providers: number;
}

export type BackupImportStrategy = 'merge' | 'replace';

export interface GitHubBackupResult {
  url: string;
  sha: string;
  updatedAt: string;
}

const GITHUB_TOKEN_KEY = 'github-backup-token';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function redactedProvider(provider: ProviderConfig): RedactedProvider {
  const { apiKey: _apiKey, ...rest } = provider;
  return { ...rest, apiKey: '' };
}

function settingsForBackup(): AppSettings {
  const next = clone(settings.current);
  next.githubBackup = {
    ...next.githubBackup,
    tokenSaved: false,
  };
  return next;
}

async function hasGitHubBackupToken(): Promise<boolean> {
  return Boolean(await idbGet<Uint8Array>(STORES.settings, GITHUB_TOKEN_KEY));
}

async function settingsForImport(value: AppSettings): Promise<AppSettings> {
  const next = clone(value);
  next.githubBackup = {
    owner: next.githubBackup?.owner ?? '',
    repo: next.githubBackup?.repo ?? '',
    branch: next.githubBackup?.branch || 'main',
    path: next.githubBackup?.path || 'tragents/backup.json',
    lastBackupAt: next.githubBackup?.lastBackupAt,
    tokenSaved: await hasGitHubBackupToken(),
  };
  return next;
}

function assertBackup(payload: unknown): asserts payload is LocalBackupPayload {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file.');
  const p = payload as Partial<LocalBackupPayload>;
  if (p.kind !== 'tragents.local-backup' || p.version !== 1) {
    throw new Error('This file is not a supported Tragents backup.');
  }
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function decodeBase64(text: string): string {
  const binary = atob(text.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function githubConfig() {
  const cfg = settings.current.githubBackup;
  const owner = cfg.owner.trim();
  const repo = cfg.repo.trim();
  const branch = (cfg.branch || 'main').trim();
  const path = (cfg.path || 'tragents/backup.json').trim().replace(/^\/+/, '');
  if (!owner || !repo || !branch || !path) {
    throw new Error('Fill GitHub owner, repo, branch, and backup path first.');
  }
  return { owner, repo, branch, path };
}

async function githubToken(): Promise<string> {
  const encrypted = await idbGet<Uint8Array>(STORES.settings, GITHUB_TOKEN_KEY);
  if (!encrypted) throw new Error('Save a GitHub token first.');
  const token = await decryptString(encrypted);
  if (!token.trim()) throw new Error('Save a GitHub token first.');
  return token.trim();
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await githubToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* keep status text */
    }
    throw new Error(`GitHub backup failed: ${message}`);
  }
  return (await response.json()) as T;
}

export async function saveGitHubBackupToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    await clearGitHubBackupToken();
    return;
  }
  await idbPut(STORES.settings, await encryptString(trimmed), GITHUB_TOKEN_KEY);
  await settings.updateGitHubBackup({ tokenSaved: true });
}

export async function clearGitHubBackupToken(): Promise<void> {
  await idbDelete(STORES.settings, GITHUB_TOKEN_KEY);
  await settings.updateGitHubBackup({ tokenSaved: false });
}

export function createLocalBackup(): LocalBackupPayload {
  return {
    kind: 'tragents.local-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settingsForBackup(),
    providers: providers.list.map(redactedProvider),
    projects: clone(projects.list),
    glossaries: clone(glossaries.list),
    checkpoints: clone(checkpoints.list),
    sessions: clone(sessions.list),
    tasks: clone(tasks.list),
    activities: clone(activities.list),
    memories: clone(memories.list),
  };
}

export function downloadLocalBackup(): string {
  const payload = createLocalBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const stamp = payload.exportedAt.replace(/[:.]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `tragents-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
}

export async function readLocalBackup(file: File): Promise<LocalBackupPayload> {
  const parsed = JSON.parse(await file.text()) as unknown;
  assertBackup(parsed);
  return parsed;
}

async function clearRestoredStores() {
  await Promise.all([
    idbClear(STORES.providers),
    idbClear(STORES.projects),
    idbClear(STORES.glossaries),
    idbClear(STORES.checkpoints),
    idbClear(STORES.sessions),
    idbClear(STORES.tasks),
    idbClear(STORES.activities),
    idbClear(STORES.memories),
  ]);
}

export async function importLocalBackup(
  payload: LocalBackupPayload,
  options: { strategy?: BackupImportStrategy } = {},
): Promise<BackupImportSummary> {
  assertBackup(payload);

  if ((options.strategy ?? 'merge') === 'replace') {
    await clearRestoredStores();
  }

  await idbPut(STORES.settings, await settingsForImport(payload.settings), SETTINGS_KEY);

  for (const provider of payload.providers ?? []) {
    await idbPut(STORES.providers, {
      ...provider,
      apiKey: await encryptString(''),
    });
  }
  for (const project of payload.projects ?? []) await idbPut(STORES.projects, project);
  for (const glossary of payload.glossaries ?? []) await idbPut(STORES.glossaries, glossary);
  for (const checkpoint of payload.checkpoints ?? []) await idbPut(STORES.checkpoints, checkpoint);
  for (const session of payload.sessions ?? []) await idbPut(STORES.sessions, session);
  for (const task of payload.tasks ?? []) await idbPut(STORES.tasks, task);
  for (const activity of payload.activities ?? []) await idbPut(STORES.activities, activity);
  for (const memory of payload.memories ?? []) {
    const { projectId, ...patch } = memory;
    await memories.upsert(projectId, patch);
  }

  await Promise.all([
    settings.load(),
    providers.load(),
    projects.load(),
    glossaries.load(),
    checkpoints.load(),
    sessions.load(),
    tasks.load(),
    activities.load(),
    memories.load(),
  ]);

  return {
    projects: payload.projects?.length ?? 0,
    glossaries: payload.glossaries?.length ?? 0,
    checkpoints: payload.checkpoints?.length ?? 0,
    sessions: payload.sessions?.length ?? 0,
    tasks: payload.tasks?.length ?? 0,
    activities: payload.activities?.length ?? 0,
    memories: payload.memories?.length ?? 0,
    providers: payload.providers?.length ?? 0,
  };
}

export async function pushBackupToGitHub(): Promise<GitHubBackupResult> {
  const { owner, repo, branch, path } = githubConfig();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
  const existing = await githubRequest<{ sha?: string } | { message?: string }>(
    `${url}?ref=${encodeURIComponent(branch)}`,
    { method: 'GET' },
  ).catch((err: unknown) => {
    if (err instanceof Error && /not found/i.test(err.message)) return undefined;
    throw err;
  });

  const payload = createLocalBackup();
  const updatedAt = payload.exportedAt;
  const body: {
    message: string;
    branch: string;
    content: string;
    sha?: string;
  } = {
    message: `backup: Tragents ${updatedAt}`,
    branch,
    content: encodeBase64(JSON.stringify(payload, null, 2)),
  };
  if (existing && 'sha' in existing && existing.sha) body.sha = existing.sha;

  const response = await githubRequest<{
    content: { sha: string; html_url: string };
  }>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  await settings.updateGitHubBackup({ lastBackupAt: updatedAt });
  return {
    url: response.content.html_url,
    sha: response.content.sha,
    updatedAt,
  };
}

export async function restoreBackupFromGitHub(
  options: { strategy?: BackupImportStrategy } = {},
): Promise<BackupImportSummary> {
  const { owner, repo, branch, path } = githubConfig();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  const response = await githubRequest<{ content?: string; encoding?: string }>(url);
  if (!response.content || response.encoding !== 'base64') {
    throw new Error('GitHub file is not a readable backup JSON.');
  }
  const parsed = JSON.parse(decodeBase64(response.content)) as unknown;
  assertBackup(parsed);
  return await importLocalBackup(parsed, options);
}
