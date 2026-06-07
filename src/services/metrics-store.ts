import type { Response } from 'express';

export interface RequestRecord {
  path: string;
  method: string;
  status: number;
  ms: number;
  ts: number;
}

const MAX_BUFFER = 10_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const buffer: RequestRecord[] = [];
const sseClients = new Set<Response>();

export function record(entry: RequestRecord): void {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) {
    buffer.splice(0, buffer.length - MAX_BUFFER);
  }

  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

export function addSseClient(res: Response): void {
  sseClients.add(res);
}

export function removeSseClient(res: Response): void {
  sseClients.delete(res);
}

export function getSummary(windowMs = ONE_HOUR_MS): {
  total: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  window: string;
} {
  const since = Date.now() - windowMs;
  const window = buffer.filter(r => r.ts >= since);
  const errors = window.filter(r => r.status >= 400).length;
  const avgMs = window.length > 0 ? Math.round(window.reduce((s, r) => s + r.ms, 0) / window.length) : 0;

  return {
    total: window.length,
    errors,
    errorRate: window.length > 0 ? Math.round((errors / window.length) * 100) / 100 : 0,
    avgMs,
    window: `${windowMs / 1000 / 60}m`,
  };
}

export function getTopEndpoints(limit = 10, windowMs = ONE_HOUR_MS): Array<{
  endpoint: string;
  count: number;
  errors: number;
  avgMs: number;
}> {
  const since = Date.now() - windowMs;
  const window = buffer.filter(r => r.ts >= since);

  const map = new Map<string, { count: number; errors: number; totalMs: number }>();
  for (const r of window) {
    const key = `${r.method} ${r.path}`;
    const entry = map.get(key) ?? { count: 0, errors: 0, totalMs: 0 };
    entry.count++;
    if (r.status >= 400) entry.errors++;
    entry.totalMs += r.ms;
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([endpoint, s]) => ({
      endpoint,
      count: s.count,
      errors: s.errors,
      avgMs: Math.round(s.totalMs / s.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
