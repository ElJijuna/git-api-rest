import { Router } from 'express';
import { addSseClient, removeSseClient, getSummary, getTopEndpoints } from '../services/metrics-store.js';

const router = Router();

router.get('/api/metrics', (req, res) => {
  const windowParam = String(req.query['window'] ?? '1h');
  const windowMs = parseWindow(windowParam);
  const summary = getSummary(windowMs);
  res.json(summary);
});

router.get('/api/metrics/endpoints', (req, res) => {
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '10'), 10), 50);
  const windowParam = String(req.query['window'] ?? '1h');
  const windowMs = parseWindow(windowParam);
  const endpoints = getTopEndpoints(limit, windowMs);
  res.json({ endpoints });
});

router.get('/api/metrics/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(': ping\n\n');

  addSseClient(res);

  req.on('close', () => {
    removeSseClient(res);
  });
});

function parseWindow(w: string): number {
  const match = w.match(/^(\d+)(m|h|d)$/);
  if (!match) return 60 * 60 * 1000;
  const n = parseInt(match[1] ?? '1', 10);
  const unit = match[2];
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
}

export default router;
