import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { metricsCollector } from './middleware/metrics-collector.js';
import healthRouter from './routes/health.js';
import projectsRouter from './routes/projects.js';
import repoInfoRouter from './routes/repo-info.js';
import commitsRouter from './routes/commits.js';
import filesRouter from './routes/files.js';
import compareRouter from './routes/compare.js';
import metricsRouter from './routes/metrics.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use(metricsCollector);

  const uiDist = path.join(__dirname, '..', 'ui', 'dist');
  if (process.env['NODE_ENV'] === 'production' && fs.existsSync(uiDist)) {
    app.use(express.static(uiDist));
  }

  app.use(healthRouter);
  app.use(projectsRouter);
  app.use(repoInfoRouter);
  app.use(commitsRouter);
  app.use(filesRouter);
  app.use(compareRouter);
  app.use(metricsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
}
