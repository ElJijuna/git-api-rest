import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import type { DefaultLogFields, SimpleGit } from 'simple-git';
import type { AppConfig, RepoEntry } from '../config/types.js';
import { buildRepoUrl } from '../config/index.js';
import { logger } from '../middleware/logger.js';
import { getAll, getOrThrow, register, update } from './repo-store.js';

// --- Concurrency: promise-chain mutex per repo ---

const locks = new Map<string, Promise<void>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(r => { release = r; });
  locks.set(key, current);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}

// --- Git instance factory ---

function makeGit(baseDir?: string): SimpleGit {
  return baseDir
    ? simpleGit(baseDir, { maxConcurrentProcesses: 1 })
    : simpleGit({ maxConcurrentProcesses: 1 });
}

// --- Ref resolution ---

function resolveRef(entry: RepoEntry, ref?: string): string {
  return ref ?? entry.branch;
}

// --- Path validation ---

function validateFilePath(filePath: string): void {
  if (filePath.includes('\0') || filePath.split('/').some(seg => seg === '..')) {
    const err = Object.assign(new Error(`Invalid file path: ${filePath}`), { statusCode: 400 });
    throw err;
  }
}

// --- Clone & pull ---

async function cloneRepo(entry: RepoEntry, clonePath: string, resolvedUrl: string): Promise<void> {
  const parentDir = path.dirname(clonePath);
  await fs.promises.mkdir(parentDir, { recursive: true });

  await makeGit().clone(resolvedUrl, clonePath, [
    '--filter=blob:none',
    `--branch=${entry.branch}`,
  ]);

  const git = makeGit(clonePath);
  await git.addConfig('user.name', process.env['GIT_USER_NAME'] ?? 'git-api-rest');
  await git.addConfig('user.email', process.env['GIT_USER_EMAIL'] ?? 'git-api-rest@localhost');
}

// --- Startup ---

export async function initializeAll(config: AppConfig): Promise<void> {
  const results = await Promise.allSettled(
    config.repos.map(async entry => {
      const clonePath = entry.cloneDir
        ?? path.join(config.cloneBasePath, entry.key.toLowerCase(), entry.repo);

      const resolvedUrl = buildRepoUrl(entry, config.bitbucket);

      register(entry, clonePath, resolvedUrl);
      update(entry.key, entry.repo, { status: 'cloning' });

      const alreadyCloned = fs.existsSync(path.join(clonePath, '.git'));
      if (!alreadyCloned) {
        logger.info({ repo: `${entry.key}/${entry.repo}` }, 'Cloning...');
        await cloneRepo(entry, clonePath, resolvedUrl);
      } else {
        logger.info({ repo: `${entry.key}/${entry.repo}` }, 'Already cloned, fetching...');
        const git = makeGit(clonePath);
        await git.fetch(['--all', '--tags']);
      }

      update(entry.key, entry.repo, { status: 'ready', lastPulledAt: Date.now() });
      logger.info({ repo: `${entry.key}/${entry.repo}` }, 'Ready');
    }),
  );

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      const entry = config.repos[i];
      if (entry) {
        update(entry.key, entry.repo, { status: 'error', lastError: String(result.reason) });
        logger.error({ repo: `${entry.key}/${entry.repo}`, err: result.reason }, 'Init failed');
      }
    }
  }
}

// --- Background pull scheduler ---

export function startPullScheduler(config: AppConfig): NodeJS.Timeout {
  return setInterval(async () => {
    for (const state of getAll()) {
      if (state.status !== 'ready') continue;

      const lockKey = `${state.entry.key}:${state.entry.repo}`;
      withLock(lockKey, async () => {
        const git = makeGit(state.clonePath);
        await git.fetch(['--all', '--tags']);
        await git.reset(['--hard', `origin/${state.entry.branch}`]);
        update(state.entry.key, state.entry.repo, { lastPulledAt: Date.now(), lastError: undefined });
        logger.debug({ repo: `${state.entry.key}/${state.entry.repo}` }, 'Pulled');
      }).catch(err => {
        logger.warn({ repo: `${state.entry.key}/${state.entry.repo}`, err }, 'Pull failed');
      });
    }
  }, config.pullIntervalMs);
}

// --- Read operations ---

export interface CommitEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
}

export interface TreeEntry {
  mode: string;
  type: 'blob' | 'tree';
  hash: string;
  size: number | null;
  name: string;
}

export interface RepoInfo {
  key: string;
  name: string;
  url: string;
  branch: string;
  status: string;
  lastPulledAt: string | null;
  lastCommit: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
  } | null;
}

export interface ContributorEntry {
  name: string;
  email: string;
  commits: number;
}

export interface BlameEntry {
  lineNumber: number;
  content: string;
  commit: string;
  author: string;
  date: string;
}

export interface CompareResult {
  from: string;
  to: string;
  aheadBy: number;
  behindBy: number;
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
  }>;
}

function parseLsTree(output: string, basePath = ''): TreeEntry[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\s+/);
      const mode = parts[0] ?? '';
      const type = (parts[1] ?? '') as 'blob' | 'tree';
      const hash = parts[2] ?? '';
      const sizeStr = parts[3] ?? '-';
      const size = sizeStr === '-' ? null : parseInt(sizeStr, 10);
      const name = parts.slice(4).join(' ').trim();
      return { mode, type, hash, size, name: basePath ? `${basePath}/${name}` : name };
    });
}

function parseBlame(output: string): BlameEntry[] {
  const lines: BlameEntry[] = [];
  const blocks = output.split(/^([0-9a-f]{40}) /m).filter(Boolean);

  let currentCommit = '';
  let currentAuthor = '';
  let currentDate = '';
  let lineNumber = 0;

  for (const block of output.split('\n')) {
    const commitMatch = block.match(/^([0-9a-f]{40})\s+\d+\s+(\d+)/);
    if (commitMatch) {
      currentCommit = commitMatch[1] ?? '';
      lineNumber = parseInt(commitMatch[2] ?? '0', 10);
      continue;
    }
    if (block.startsWith('author ')) currentAuthor = block.slice(7);
    if (block.startsWith('author-time ')) currentDate = new Date(parseInt(block.slice(12), 10) * 1000).toISOString();
    if (block.startsWith('\t')) {
      lines.push({
        lineNumber,
        content: block.slice(1),
        commit: currentCommit.slice(0, 7),
        author: currentAuthor,
        date: currentDate,
      });
    }
  }

  // Fallback: unused variable suppression
  void blocks;
  return lines;
}

export async function getRepoInfo(key: string, repo: string, ref?: string): Promise<RepoInfo> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, ref);
    const log = await git.log({ from: ref_, maxCount: 1 });
    const latest = log.latest;

    return {
      key: state.entry.key,
      name: state.entry.repo,
      url: state.entry.url ?? '',
      branch: state.entry.branch,
      status: state.status,
      lastPulledAt: state.lastPulledAt > 0 ? new Date(state.lastPulledAt).toISOString() : null,
      lastCommit: latest
        ? {
          hash: latest.hash,
          shortHash: latest.hash.slice(0, 7),
          message: latest.message,
          author: latest.author_name,
          date: latest.date,
        }
        : null,
    };
  });
}

export async function getBranches(key: string, repo: string): Promise<Array<{ name: string; isCurrent: boolean; lastCommit: string }>> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const result = await git.branch(['-a', '--no-abbrev']);
    return result.all.map(name => ({
      name: name.replace(/^remotes\/origin\//, ''),
      isCurrent: name === result.current,
      lastCommit: result.branches[name]?.commit ?? '',
    }));
  });
}

export async function getTags(key: string, repo: string): Promise<Array<{ name: string; commit: string; date: string }>> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const raw = await git.raw(['tag', '-l', '--format=%(refname:short)|%(objectname:short)|%(creatordate:iso)']);
    return raw
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [name, commit, date] = line.split('|');
        return { name: name ?? '', commit: commit ?? '', date: date ?? '' };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });
}

export interface GetCommitsOptions {
  ref?: string;
  limit: number;
  page: number;
  author?: string;
  search?: string;
}

export async function getCommits(
  key: string,
  repo: string,
  opts: GetCommitsOptions,
): Promise<{ commits: CommitEntry[]; page: number; limit: number; has_more: boolean }> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, opts.ref);
    const skip = (opts.page - 1) * opts.limit;

    const logOptions: Record<string, unknown> = {
      from: ref_,
      maxCount: opts.limit + 1,
      '--skip': skip,
    };
    if (opts.author) logOptions['--author'] = opts.author;
    if (opts.search) logOptions['--grep'] = opts.search;

    const result = await git.log<DefaultLogFields>(logOptions as never);
    const has_more = result.all.length > opts.limit;
    const commits = result.all.slice(0, opts.limit).map(c => ({
      hash: c.hash,
      shortHash: c.hash.slice(0, 7),
      message: c.message,
      author: c.author_name,
      email: c.author_email,
      date: c.date,
    }));

    return { commits, page: opts.page, limit: opts.limit, has_more };
  });
}

export async function getContributors(key: string, repo: string, ref?: string): Promise<ContributorEntry[]> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, ref);
    const raw = await git.raw(['shortlog', '-sne', ref_]);

    return raw
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const match = line.match(/^\s*(\d+)\s+(.+?)\s+<(.+?)>/);
        return match
          ? { commits: parseInt(match[1] ?? '0', 10), name: match[2] ?? '', email: match[3] ?? '' }
          : null;
      })
      .filter((e): e is ContributorEntry => e !== null)
      .sort((a, b) => b.commits - a.commits);
  });
}

export async function getStats(key: string, repo: string, ref?: string): Promise<{
  commits: number;
  files: number;
  contributors: number;
  branch: string;
  ref: string;
}> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, ref);

    const [commitCountRaw, filesRaw, contributorsRaw] = await Promise.all([
      git.raw(['rev-list', '--count', ref_]),
      git.raw(['ls-tree', '-r', '--name-only', ref_]),
      git.raw(['shortlog', '-s', ref_]),
    ]);

    return {
      commits: parseInt(commitCountRaw.trim(), 10),
      files: filesRaw.split('\n').filter(Boolean).length,
      contributors: contributorsRaw.split('\n').filter(Boolean).length,
      branch: state.entry.branch,
      ref: ref_,
    };
  });
}

export async function getActivity(
  key: string,
  repo: string,
  period: 'daily' | 'weekly' | 'monthly',
  ref?: string,
): Promise<{ period: string; buckets: Array<{ date: string; count: number }> }> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, ref);

    const raw = await git.raw(['log', `--format=%ad`, '--date=format:%Y-%m-%d', ref_]);
    const dates = raw.split('\n').filter(Boolean);

    const buckets = new Map<string, number>();
    for (const date of dates) {
      const key = period === 'monthly' ? date.slice(0, 7) : period === 'weekly' ? getWeekStart(date) : date;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const sorted = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return { period, buckets: sorted };
  });
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export async function getFileTree(key: string, repo: string, treePath?: string, ref?: string): Promise<TreeEntry[]> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, ref);
    const treeRef = treePath ? `${ref_}:${treePath}` : ref_;
    const raw = await git.raw(['ls-tree', '--long', treeRef]);
    return parseLsTree(raw, treePath);
  });
}

export async function getFileContent(key: string, repo: string, filePath: string, ref?: string): Promise<string> {
  validateFilePath(filePath);
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, ref);
    try {
      return await git.show([`${ref_}:${filePath}`]);
    } catch {
      throw Object.assign(new Error(`File not found: ${filePath} at ref ${ref_}`), { statusCode: 404 });
    }
  });
}

export interface GetFileHistoryOptions {
  ref?: string;
  limit: number;
  page: number;
}

export async function getFileHistory(
  key: string,
  repo: string,
  filePath: string,
  opts: GetFileHistoryOptions,
): Promise<{ commits: CommitEntry[]; page: number; limit: number; has_more: boolean }> {
  validateFilePath(filePath);
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, opts.ref);
    const skip = (opts.page - 1) * opts.limit;

    const result = await git.log<DefaultLogFields>({
      file: filePath,
      from: ref_,
      maxCount: opts.limit + 1,
      '--skip': skip,
    } as never);

    const has_more = result.all.length > opts.limit;
    const commits = result.all.slice(0, opts.limit).map(c => ({
      hash: c.hash,
      shortHash: c.hash.slice(0, 7),
      message: c.message,
      author: c.author_name,
      email: c.author_email,
      date: c.date,
    }));

    return { commits, page: opts.page, limit: opts.limit, has_more };
  });
}

export async function getBlame(key: string, repo: string, filePath: string, ref?: string): Promise<BlameEntry[]> {
  validateFilePath(filePath);
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    const ref_ = resolveRef(state.entry, ref);
    const raw = await git.raw(['blame', '--porcelain', ref_, '--', filePath]);
    return parseBlame(raw);
  });
}

export async function getCompare(key: string, repo: string, from: string, to: string): Promise<CompareResult> {
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);

    const [aheadRaw, behindRaw, diffRaw] = await Promise.all([
      git.raw(['rev-list', '--count', `${from}..${to}`]),
      git.raw(['rev-list', '--count', `${to}..${from}`]),
      git.raw(['diff', '--numstat', `${from}...${to}`]),
    ]);

    const files = diffRaw
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const parts = line.split('\t');
        return {
          path: parts[2] ?? '',
          additions: parseInt(parts[0] ?? '0', 10),
          deletions: parseInt(parts[1] ?? '0', 10),
        };
      });

    return {
      from,
      to,
      aheadBy: parseInt(aheadRaw.trim(), 10),
      behindBy: parseInt(behindRaw.trim(), 10),
      files,
    };
  });
}

export async function getDiff(key: string, repo: string, filePath: string, from: string, to: string): Promise<string> {
  validateFilePath(filePath);
  const state = getOrThrow(key, repo);
  const lockKey = `${key.toUpperCase()}:${repo.toLowerCase()}`;

  return withLock(lockKey, async () => {
    const git = makeGit(state.clonePath);
    return git.diff([`${from}...${to}`, '--', filePath]);
  });
}
