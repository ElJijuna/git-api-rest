import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import mockData from './ui/mock/mockData.js';

const SSE_LOG_LINES = [
  { level: 'info', message: 'git-api-rest started on port 3000' },
  { level: 'info', message: 'GET /api/projects' },
  { level: 'info', message: 'Cloning MYPROJECT/my-repo...' },
  { level: 'debug', message: 'git clone: counting objects 100%' },
  { level: 'debug', message: 'git clone: receiving objects 100%' },
  { level: 'info', message: 'Ready: MYPROJECT/my-repo' },
  { level: 'info', message: 'GET /api/projects/MYPROJECT/repos/my-repo/commits' },
  { level: 'info', message: 'GET /api/projects/MYPROJECT/repos/my-repo/files' },
  { level: 'warn', message: 'Pull warning: INFRA/k8s-config: could not read Username' },
  { level: 'info', message: 'Pulled: MYPROJECT/my-repo' },
  { level: 'debug', message: 'GET /health → 200 in 2ms' },
  { level: 'info', message: 'GET /api/metrics/endpoints' },
];

const SSE_METRIC_ENDPOINTS = [
  { method: 'GET', path: '/api/projects/MYPROJECT/repos/my-repo/commits', status: 200, ms: 12 },
  { method: 'GET', path: '/api/projects/MYPROJECT/repos/my-repo/files', status: 200, ms: 8 },
  { method: 'GET', path: '/health', status: 200, ms: 2 },
  { method: 'GET', path: '/api/metrics/endpoints', status: 200, ms: 3 },
  { method: 'GET', path: '/api/projects/MYPROJECT/repos/my-repo', status: 200, ms: 15 },
  { method: 'GET', path: '/api/projects/MYPROJECT/repos/missing/commits', status: 404, ms: 1 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPlugin = () => ({
  name: 'mock-server',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const [pathname] = req.url.split('?');

      if (pathname === '/api/logs/stream') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        let i = 0;
        const send = () => {
          const entry = { ...SSE_LOG_LINES[i % SSE_LOG_LINES.length]!, timestamp: new Date().toISOString() };
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
          i++;
        };
        send();
        const timer = setInterval(send, 1500);
        req.on('close', () => clearInterval(timer));
        return;
      }

      if (pathname === '/api/metrics/stream') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        let i = 0;
        const send = () => {
          const base = SSE_METRIC_ENDPOINTS[i % SSE_METRIC_ENDPOINTS.length]!;
          const entry = { ...base, ts: Date.now() };
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
          i++;
        };
        send();
        const timer = setInterval(send, 800);
        req.on('close', () => clearInterval(timer));
        return;
      }

      const mock = (mockData as any[]).find((m: any) => {
        if (m.match) return m.match(req);
        return pathname === m.url && req.method === m.method;
      });
      if (mock) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mock.response(req)));
      } else {
        next();
      }
    });
  },
});

const useMocks = process.env['MOCK'] !== 'false';

export default defineConfig({
  root: './ui',
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
    ...(useMocks ? [mockPlugin()] : []),
  ],
  server: {
    port: 5173,
    proxy: useMocks ? {} : {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
});
