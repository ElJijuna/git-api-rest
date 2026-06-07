import { Router } from 'express';
import { getCommits } from '../services/git-manager.js';

const router = Router();

router.get('/api/projects/:key/repos/:repo/commits', async (req, res) => {
  const { key, repo } = req.params;
  const ref = req.query['ref'] as string | undefined;
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '20'), 10), 100);
  const page = Math.max(parseInt(String(req.query['page'] ?? '1'), 10), 1);
  const author = req.query['author'] as string | undefined;
  const search = req.query['search'] as string | undefined;

  const result = await getCommits(key ?? '', repo ?? '', { ref, limit, page, author, search });
  res.json(result);
});

export default router;
