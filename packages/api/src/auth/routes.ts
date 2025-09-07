import { Hono } from 'hono';
import type { HonoContext, RouteContext } from '../serve';
import { protect } from './utils';

export default function routes(): Hono<HonoContext> {
  const router = new Hono<HonoContext>();

  router.post('/register', async (c) => {
    const auth = c.get('container').auth;
    const { username, email, password } = await c.req.json();
    const result = await auth.register({ username, email, password });
    return c.json(result);
  });

  router.post('/login', async (c) => {
    const auth = c.get('container').auth;
    const { username, password } = await c.req.json();
    const result = await auth.login({ username, password });
    return c.json(result);
  });

  router.get('/whoami', protect(), async (c) => {
    const auth = c.get('container').auth;
    const { token } = await c.req.json();
    const result = await auth.whoami({ token });
    return c.json(result);
  });

  router.post('/change-password', protect(), async (c) => {
    const auth = c.get('container').auth;
    const { token, currentPassword, newPassword } = await c.req.json();
    const result = await auth.changePassword({
      token,
      currentPassword,
      newPassword,
    });
    return c.json(result);
  });

  return router;
}
