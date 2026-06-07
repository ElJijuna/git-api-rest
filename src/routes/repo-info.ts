import { Router } from 'express';
import {
  getActivity,
  getBranches,
  getContributors,
  getRepoInfo,
  getStats,
  getTags,
} from '../services/git-manager.js';

const router = Router();
const BASE = '/api/projects/:key/repos/:repo';

router.get(BASE, async (req, res) => {
  const { key, repo } = req.params;
  const ref = req.query['ref'] as string | undefined;
  const info = await getRepoInfo(key ?? '', repo ?? '', ref);
  res.json(info);
});

router.get(`${BASE}/branches`, async (req, res) => {
  const { key, repo } = req.params;
  const branches = await getBranches(key ?? '', repo ?? '');
  res.json({ branches });
});

router.get(`${BASE}/tags`, async (req, res) => {
  const { key, repo } = req.params;
  const tags = await getTags(key ?? '', repo ?? '');
  res.json({ tags });
});

router.get(`${BASE}/contributors`, async (req, res) => {
  const { key, repo } = req.params;
  const ref = req.query['ref'] as string | undefined;
  const contributors = await getContributors(key ?? '', repo ?? '', ref);
  res.json({ contributors });
});

router.get(`${BASE}/stats`, async (req, res) => {
  const { key, repo } = req.params;
  const ref = req.query['ref'] as string | undefined;
  const stats = await getStats(key ?? '', repo ?? '', ref);
  res.json(stats);
});

router.get(`${BASE}/stats/activity`, async (req, res) => {
  const { key, repo } = req.params;
  const ref = req.query['ref'] as string | undefined;
  const period = (req.query['period'] as string | undefined) ?? 'daily';

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    res.status(400).json({ error: 'period must be daily, weekly, or monthly' });
    return;
  }

  const activity = await getActivity(key ?? '', repo ?? '', period as 'daily' | 'weekly' | 'monthly', ref);
  res.json(activity);
});

export default router;
