import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = isDev
  ? pino({ level: process.env['LOG_LEVEL'] ?? 'info' }, pino.transport({ target: 'pino-pretty', options: { colorize: true } }))
  : pino({ level: process.env['LOG_LEVEL'] ?? 'info' });
