import type { Next } from 'hono';
import { buildContainer } from './container.js';
import type { RouteContext } from './serve.js';

export async function useContainer(c: RouteContext, next: Next) {
  const container = buildContainer();
  c.set('container', container.cradle);
  await next();
  await container.dispose();
}

export async function useHealthCheck(c: RouteContext) {
  console.log('Health check');
  const db = c.get('container').db;
  const isHealthy = await db
    .select(1)
    .then(() => true)
    .catch(() => false);
  return c.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      // environment: config.nodeEnv,
    },
    isHealthy ? 200 : 503,
  );
}

export async function useInfo(c: RouteContext) {
  return c.json({
    message: 'Apseline API',
    version: '0.1.0',
    // environment: config.nodeEnv,
  });
}
