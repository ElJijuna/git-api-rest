import { Router } from 'express';
import { getAll } from '../services/repo-store.js';

const router = Router();

router.get('/health', (_req, res) => {
  const repos = getAll().map(s => ({
    key: s.entry.key,
    repo: s.entry.repo,
    branch: s.entry.branch,
    status: s.status,
    lastPulledAt: s.lastPulledAt > 0 ? new Date(s.lastPulledAt).toISOString() : null,
    error: s.lastError ?? null,
  }));

  const allReady = repos.every(r => r.status === 'ready');

  res.status(allReady ? 200 : 503).json({
    status: allReady ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    repos,
  });
});

export default router;
