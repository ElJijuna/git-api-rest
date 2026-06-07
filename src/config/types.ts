export interface RepoAuth {
  user?: string;
  token: string;
}

export interface RepoEntry {
  key: string;
  repo: string;
  url?: string;
  branch: string;
  cloneDir?: string;
  auth?: RepoAuth;
}

export interface BitbucketConfig {
  host: string;
  user: string;
  token: string;
  protocol: 'ssh' | 'https';
  sshPort: number;
}

export interface AppConfig {
  repos: RepoEntry[];
  cloneBasePath: string;
  pullIntervalMs: number;
  port: number;
  logLevel: string;
  nodeEnv: string;
  bitbucket?: BitbucketConfig;
}

export type CloneStatus = 'pending' | 'cloning' | 'ready' | 'error';

export interface RepoState {
  entry: RepoEntry;
  clonePath: string;
  resolvedUrl: string;
  status: CloneStatus;
  lastPulledAt: number;
  lastError?: string;
}
