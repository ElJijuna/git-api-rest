import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger.js';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode ?? err.status ?? 500;

  if (statusCode >= 500) {
    logger.error({ err }, err.message);
  } else {
    logger.warn({ statusCode }, err.message);
  }

  res.status(statusCode).json({
    error: err.message ?? 'Internal Server Error',
    status: statusCode,
    timestamp: new Date().toISOString(),
  });
}
