import { Hono } from 'hono';
import { routes as authRoutes } from './auth';

export default function routes() {
  const router = new Hono();

  router.route('/auth', authRoutes());

  return router;
}
