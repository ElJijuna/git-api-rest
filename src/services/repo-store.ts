import type { CloneStatus, RepoEntry, RepoState } from '../config/types.js';

const store = new Map<string, RepoState>();

export function storeKey(key: string, repo: string): string {
  return `${key.toUpperCase()}:${repo.toLowerCase()}`;
}

export function register(entry: RepoEntry, clonePath: string, resolvedUrl: string): RepoState {
  const k = storeKey(entry.key, entry.repo);
  const state: RepoState = {
    entry,
    clonePath,
    resolvedUrl,
    status: 'pending',
    lastPulledAt: 0,
  };
  store.set(k, state);
  return state;
}

export function get(key: string, repo: string): RepoState | undefined {
  return store.get(storeKey(key, repo));
}

export function getOrThrow(key: string, repo: string): RepoState {
  const state = store.get(storeKey(key, repo));
  if (!state) {
    const err = Object.assign(new Error(`Repo not found: ${key}/${repo}`), { statusCode: 404 });
    throw err;
  }
  if (state.status !== 'ready') {
    const err = Object.assign(
      new Error(`Repo ${key}/${repo} is not ready (status: ${state.status})`),
      { statusCode: 503 },
    );
    throw err;
  }
  return state;
}

export function getAll(): RepoState[] {
  return [...store.values()];
}

export function getProjects(): string[] {
  return [...new Set([...store.values()].map(s => s.entry.key))];
}

export function getByProject(key: string): RepoState[] {
  return [...store.values()].filter(s => s.entry.key === key.toUpperCase());
}

export function update(key: string, repo: string, patch: Partial<Pick<RepoState, 'status' | 'lastPulledAt' | 'lastError'>>): void {
  const existing = store.get(storeKey(key, repo));
  if (existing) {
    if (patch.status !== undefined) existing.status = patch.status as CloneStatus;
    if (patch.lastPulledAt !== undefined) existing.lastPulledAt = patch.lastPulledAt;
    if ('lastError' in patch) existing.lastError = patch.lastError;
  }
}
