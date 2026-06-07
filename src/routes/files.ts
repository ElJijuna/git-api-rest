import { Router } from 'express';
import { getBlame, getFileContent, getFileHistory, getFileTree } from '../services/git-manager.js';

const router = Router();
const BASE = '/api/projects/:key/repos/:repo';

router.get(`${BASE}/files`, async (req, res) => {
  const { key, repo } = req.params;
  const ref = req.query['ref'] as string | undefined;
  const treePath = req.query['path'] as string | undefined;
  const tree = await getFileTree(key ?? '', repo ?? '', treePath, ref);
  res.json({ tree });
});

router.get(`${BASE}/files/*`, async (req, res) => {
  const { key, repo } = req.params;
  const ref = req.query['ref'] as string | undefined;
  const rawParam = (req.params as unknown as Record<string, string | string[]>)['0'];
  const filePath = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam ?? '');

  const content = await getFileContent(key ?? '', repo ?? '', filePath, ref);

  const isBinary = content.includes('\0');
  if (isBinary) {
    res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
    res.type('application/octet-stream').send(content);
  } else {
    res.type('text/plain').send(content);
  }
});

router.get(`${BASE}/history/*`, async (req, res) => {
  const { key, repo } = req.params;
  const rawParam = (req.params as unknown as Record<string, string | string[]>)['0'];
  const filePath = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam ?? '');
  const ref = req.query['ref'] as string | undefined;
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '20'), 10), 100);
  const page = Math.max(parseInt(String(req.query['page'] ?? '1'), 10), 1);

  const result = await getFileHistory(key ?? '', repo ?? '', filePath, { ref, limit, page });
  res.json(result);
});

router.get(`${BASE}/blame/*`, async (req, res) => {
  const { key, repo } = req.params;
  const rawParam = (req.params as unknown as Record<string, string | string[]>)['0'];
  const filePath = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam ?? '');
  const ref = req.query['ref'] as string | undefined;

  const lines = await getBlame(key ?? '', repo ?? '', filePath, ref);
  res.json({ file: filePath, lines });
});

export default router;
