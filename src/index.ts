import 'dotenv/config';
import { loadConfig } from './config/index.js';
import { initializeAll, startPullScheduler } from './services/git-manager.js';
import { createApp } from './app.js';
import { logger } from './middleware/logger.js';

const config = loadConfig();
const app = createApp();

logger.info(`Initializing ${config.repos.length} repos...`);
await initializeAll(config);
logger.info('All repos initialized');

const pullTimer = startPullScheduler(config);

const server = app.listen(config.port, () => {
  logger.info(`git-api-rest listening on port ${config.port}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  clearInterval(pullTimer);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
