import { Router } from 'express';
import { getCompare, getDiff } from '../services/git-manager.js';

const router = Router();
const BASE = '/api/projects/:key/repos/:repo';

router.get(`${BASE}/compare`, async (req, res) => {
  const { key, repo } = req.params;
  const from = req.query['from'] as string | undefined;
  const to = req.query['to'] as string | undefined;

  if (!from || !to) {
    res.status(400).json({ error: 'from and to query params are required' });
    return;
  }

  const result = await getCompare(key ?? '', repo ?? '', from, to);
  res.json(result);
});

router.get(`${BASE}/diff/*`, async (req, res) => {
  const { key, repo } = req.params;
  const rawParam = (req.params as unknown as Record<string, string | string[]>)['0'];
  const filePath = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam ?? '');
  const from = req.query['from'] as string | undefined;
  const to = req.query['to'] as string | undefined;

  if (!from || !to) {
    res.status(400).json({ error: 'from and to query params are required' });
    return;
  }

  const diff = await getDiff(key ?? '', repo ?? '', filePath, from, to);
  res.type('text/plain').send(diff);
});

export default router;
