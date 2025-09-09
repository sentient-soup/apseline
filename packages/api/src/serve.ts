import { serve } from '@hono/node-server';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { timing } from 'hono/timing';
import type { Container } from './container.ts';
import { useContainer, useHealthCheck, useInfo } from './middleware.js';
import routes from './routes.js';

export interface HonoContext {
  Variables: {
    container: Container;
    nodeEnv: string;
    port: number;
  };
}
export type RouteContext = Context<HonoContext>;

export function startServer(): void {
  try {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const port = process.env.AL_API_PORT
      ? Number(process.env.AL_API_PORT)
      : 3001;
    const webUrl = process.env.AL_WEB_URL ?? 'http://localhost:3000';
    const hostname = new URL(process.env.AL_API_URL ?? 'http://localhost')
      .hostname;
    const apiUrl = `http://${hostname}:${port}`;

    const app = new Hono<HonoContext>();
    app.use('*', logger());
    app.use('*', timing());
    app.use('*', cors({ origin: [webUrl] }));

    app.use('*', useContainer);
    app.get('/health', useHealthCheck);
    app.get('/info', useInfo);

    app.route('/', routes());

    app.notFound((c) => {
      return c.json({ error: 'Not found' }, 404);
    });
    app.onError((err, c) => {
      console.error('Unhandled error:', err);
      return c.json({ error: 'Internal server error' }, 500);
    });

    const server = serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`🚀 Server is running at ${apiUrl}`);
        console.log(`📊 Env: ${nodeEnv}`);
        console.log(`ℹ️ Info: ${apiUrl}/info`);
        console.log(`🔗 Health: ${apiUrl}/health`);
      },
    );

    const shutdown = async () => {
      console.log('\n🛑 Shutting down server...');
      server.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
