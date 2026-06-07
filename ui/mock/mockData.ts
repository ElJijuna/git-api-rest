function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MOCK_REPOS = [
  { key: 'MYPROJECT', repo: 'my-repo', branch: 'main', status: 'ready', lastPulledAtOffset: 45000 },
  { key: 'MYPROJECT', repo: 'frontend', branch: 'develop', status: 'ready', lastPulledAtOffset: 120000 },
  { key: 'INFRA', repo: 'k8s-config', branch: 'main', status: 'error', lastPulledAtOffset: 0, error: 'Authentication failed' },
  { key: 'OSS', repo: 'public-lib', branch: 'main', status: 'ready', lastPulledAtOffset: 300000 },
];

const MOCK_COMMITS = Array.from({ length: 25 }, (_, i) => ({
  hash: `a${String(i).padStart(39, '0')}`,
  shortHash: `a${String(i).padStart(6, '0')}`,
  message: ['fix: resolve null pointer', 'feat: add pagination', 'chore: update deps', 'docs: improve readme', 'refactor: extract service'][i % 5]!,
  author: ['Alice', 'Bob', 'Carol', 'Dave'][i % 4]!,
  email: ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com'][i % 4]!,
  date: ago((i + 1) * 3600000),
}));

const MOCK_FILES = [
  { mode: '040000', type: 'tree', hash: 'abc1234', size: null, name: 'src' },
  { mode: '040000', type: 'tree', hash: 'def5678', size: null, name: 'tests' },
  { mode: '100644', type: 'blob', hash: 'ghi9012', size: 4521, name: 'package.json' },
  { mode: '100644', type: 'blob', hash: 'jkl3456', size: 1204, name: 'README.md' },
  { mode: '100644', type: 'blob', hash: 'mno7890', size: 892, name: 'tsconfig.json' },
];

const MOCK_BRANCHES = [
  { name: 'main', isCurrent: true, lastCommit: 'a000000' },
  { name: 'develop', isCurrent: false, lastCommit: 'b000001' },
  { name: 'feature/auth', isCurrent: false, lastCommit: 'c000002' },
];

const MOCK_TAGS = [
  { name: 'v1.2.0', commit: 'a000005', date: ago(7 * 24 * 3600000) },
  { name: 'v1.1.0', commit: 'a000015', date: ago(14 * 24 * 3600000) },
  { name: 'v1.0.0', commit: 'a000024', date: ago(30 * 24 * 3600000) },
];

const MOCK_CONTRIBUTORS = [
  { name: 'Alice', email: 'alice@example.com', commits: 47 },
  { name: 'Bob', email: 'bob@example.com', commits: 31 },
  { name: 'Carol', email: 'carol@example.com', commits: 18 },
  { name: 'Dave', email: 'dave@example.com', commits: 9 },
];

const MOCK_STATS = {
  commits: 105,
  files: 42,
  contributors: 4,
  branch: 'main',
  ref: 'main',
};

const MOCK_ACTIVITY = {
  period: 'weekly',
  buckets: Array.from({ length: 12 }, (_, i) => ({
    date: new Date(Date.now() - (11 - i) * 7 * 24 * 3600000).toISOString().slice(0, 10),
    count: Math.floor(Math.random() * 20) + 1,
  })),
};

const MOCK_METRICS_SUMMARY = {
  total: 247,
  errors: 12,
  errorRate: 0.05,
  avgMs: 18,
  window: '60m',
};

const MOCK_TOP_ENDPOINTS = [
  { endpoint: 'GET /api/projects/MYPROJECT/repos/my-repo/commits', count: 82, errors: 0, avgMs: 14 },
  { endpoint: 'GET /health', count: 71, errors: 0, avgMs: 2 },
  { endpoint: 'GET /api/projects/MYPROJECT/repos/my-repo/files', count: 43, errors: 2, avgMs: 22 },
  { endpoint: 'GET /api/projects', count: 28, errors: 0, avgMs: 4 },
  { endpoint: 'GET /api/metrics/endpoints', count: 15, errors: 0, avgMs: 3 },
  { endpoint: 'GET /api/projects/MYPROJECT/repos/missing', count: 8, errors: 8, avgMs: 1 },
];

const mockData = [
  { url: '/health', method: 'GET', response: () => ({ status: 'ok', timestamp: new Date().toISOString(), repos: MOCK_REPOS.map(r => ({ ...r, lastPulledAt: r.lastPulledAtOffset ? ago(r.lastPulledAtOffset) : null })) }) },
  { url: '/api/projects', method: 'GET', response: () => ({ projects: [{ key: 'MYPROJECT', repoCount: 2, readyCount: 2 }, { key: 'INFRA', repoCount: 1, readyCount: 0 }, { key: 'OSS', repoCount: 1, readyCount: 1 }] }) },
  { url: '/api/repos', method: 'GET', response: () => ({ repos: MOCK_REPOS.map(r => ({ ...r, lastPulledAt: r.lastPulledAtOffset ? ago(r.lastPulledAtOffset) : null })) }) },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && /\/api\/projects\/\w+\/repos$/.test(req.url.split('?')[0]!),
    response: (req: { url: string }) => {
      const key = req.url.match(/\/api\/projects\/(\w+)\/repos/)?.[1]?.toUpperCase();
      const repos = MOCK_REPOS.filter(r => r.key === key).map(r => ({ ...r, lastPulledAt: r.lastPulledAtOffset ? ago(r.lastPulledAtOffset) : null }));
      return { key, repos };
    },
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && /\/api\/projects\/\w+\/repos\/[\w-]+$/.test(req.url.split('?')[0]!),
    response: () => ({ key: 'MYPROJECT', name: 'my-repo', url: 'https://github.com/org/my-repo.git', branch: 'main', status: 'ready', lastPulledAt: ago(45000), lastCommit: MOCK_COMMITS[0] }),
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && req.url.includes('/commits'),
    response: () => ({ commits: MOCK_COMMITS.slice(0, 20), page: 1, limit: 20, has_more: true }),
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && /\/files$/.test(req.url.split('?')[0]!),
    response: () => ({ tree: MOCK_FILES }),
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && req.url.includes('/branches'),
    response: () => ({ branches: MOCK_BRANCHES }),
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && req.url.includes('/tags'),
    response: () => ({ tags: MOCK_TAGS }),
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && req.url.includes('/contributors'),
    response: () => ({ contributors: MOCK_CONTRIBUTORS }),
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && /\/stats$/.test(req.url.split('?')[0]!),
    response: () => MOCK_STATS,
  },
  {
    match: (req: { url: string; method: string }) => req.method === 'GET' && req.url.includes('/stats/activity'),
    response: () => MOCK_ACTIVITY,
  },
  { url: '/api/metrics', method: 'GET', response: () => MOCK_METRICS_SUMMARY },
  { url: '/api/metrics/endpoints', method: 'GET', response: () => ({ endpoints: MOCK_TOP_ENDPOINTS }) },
];

export default mockData;
