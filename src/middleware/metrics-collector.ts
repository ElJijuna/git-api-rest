import type { NextFunction, Request, Response } from 'express';
import { record } from '../services/metrics-store.js';

export function metricsCollector(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    record({
      path: req.path,
      method: req.method,
      status: res.statusCode,
      ms,
      ts: Date.now(),
    });
  });

  next();
}
