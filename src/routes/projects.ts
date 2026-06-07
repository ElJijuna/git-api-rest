import { Router } from 'express';
import { getAll, getByProject, getProjects } from '../services/repo-store.js';

const router = Router();

router.get('/api/projects', (_req, res) => {
  const projects = getProjects().map(key => {
    const repos = getByProject(key);
    return {
      key,
      repoCount: repos.length,
      readyCount: repos.filter(r => r.status === 'ready').length,
    };
  });
  res.json({ projects });
});

router.get('/api/projects/:key/repos', (req, res) => {
  const { key } = req.params;
  const repos = getByProject(key ?? '').map(s => ({
    key: s.entry.key,
    repo: s.entry.repo,
    branch: s.entry.branch,
    status: s.status,
    lastPulledAt: s.lastPulledAt > 0 ? new Date(s.lastPulledAt).toISOString() : null,
  }));

  if (repos.length === 0) {
    res.status(404).json({ error: `Project not found: ${key}` });
    return;
  }

  res.json({ key, repos });
});

router.get('/api/repos', (_req, res) => {
  const repos = getAll().map(s => ({
    key: s.entry.key,
    repo: s.entry.repo,
    branch: s.entry.branch,
    status: s.status,
    lastPulledAt: s.lastPulledAt > 0 ? new Date(s.lastPulledAt).toISOString() : null,
    error: s.lastError ?? null,
  }));
  res.json({ repos });
});

export default router;
