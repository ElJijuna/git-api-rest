import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { AppConfig, BitbucketConfig, RepoEntry } from './types.js';

function buildBitbucketUrl(entry: RepoEntry, bitbucket: BitbucketConfig): string {
  const hostClean = bitbucket.host.replace(/^https?:\/\//, '');

  if (bitbucket.protocol === 'https') {
    const user = encodeURIComponent(bitbucket.user);
    const token = encodeURIComponent(bitbucket.token);
    return `https://${user}:${token}@${hostClean}/scm/${entry.key.toLowerCase()}/${entry.repo}.git`;
  }

  return `ssh://git@${hostClean}:${bitbucket.sshPort}/scm/${entry.key.toLowerCase()}/${entry.repo}.git`;
}

function buildRepoUrl(entry: RepoEntry, bitbucket?: BitbucketConfig): string {
  if (entry.url) {
    if (!entry.auth) return entry.url;

    const authUser = entry.auth.user ?? 'git';
    const token = encodeURIComponent(entry.auth.token);
    return entry.url.replace(/^(https?:\/\/)/, `$1${authUser}:${token}@`);
  }

  if (bitbucket) {
    return buildBitbucketUrl(entry, bitbucket);
  }

  const envKey = `AUTH_TOKEN_${entry.key.toUpperCase()}_${entry.repo.toUpperCase().replace(/-/g, '_')}`;
  const envToken = process.env[envKey];
  if (envToken) {
    return `https://git:${encodeURIComponent(envToken)}@github.com/${entry.key}/${entry.repo}.git`;
  }

  throw new Error(
    `Repo ${entry.key}/${entry.repo} has no url and no Bitbucket config. ` +
    `Set BITBUCKET_SERVER_HOST or provide an explicit url in repos.yml.`,
  );
}

function parseBitbucketConfig(): BitbucketConfig | undefined {
  const host = process.env['BITBUCKET_SERVER_HOST'];
  if (!host) return undefined;

  return {
    host,
    user: process.env['BITBUCKET_USER'] ?? '',
    token: process.env['BITBUCKET_TOKEN'] ?? '',
    protocol: (process.env['GIT_CLONE_PROTOCOL'] ?? 'ssh') as 'ssh' | 'https',
    sshPort: parseInt(process.env['BITBUCKET_SSH_PORT'] ?? '7999', 10),
  };
}

export function loadConfig(): AppConfig {
  const configPath = process.env['REPOS_CONFIG_PATH'] ?? path.resolve(process.cwd(), 'repos.yml');

  let repos: RepoEntry[];

  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.load(raw) as { repos: RepoEntry[] };
    repos = parsed.repos;
  } else if (process.env['REPOS']) {
    repos = JSON.parse(process.env['REPOS']) as RepoEntry[];
  } else {
    throw new Error(
      `No repo config found. Checked: ${configPath} and REPOS env var.`,
    );
  }

  for (const r of repos) {
    if (!r.key || !r.repo || !r.branch) {
      throw new Error(`Invalid repo entry (missing key/repo/branch): ${JSON.stringify(r)}`);
    }
    r.key = r.key.toUpperCase();
    r.repo = r.repo.toLowerCase();
  }

  const bitbucket = parseBitbucketConfig();

  return {
    repos,
    cloneBasePath: process.env['CLONE_BASE_PATH'] ?? '/data/repos',
    pullIntervalMs: parseInt(process.env['GIT_PULL_INTERVAL'] ?? '60', 10) * 1000,
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    bitbucket,
  };
}

export { buildRepoUrl };
