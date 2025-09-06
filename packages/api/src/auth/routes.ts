import { Hono } from 'hono';

export function routes() {
    const router = new Hono();
router.post('/auth/register', async (c) => {
		const body = (await c.req.json()) as any;
		return c.req.context.auth.register(body);
	});
	
	// POST /auth/login
	auth.post('/auth/login', async (c) => {
		const body = (await c.req.json()) as LoginRequest;
		return c.req.context.auth.register(body);
		
});

// GET /auth/me (requires authentication)
auth.get('/auth/me', requireAuth(), async (c) => {
	try {
		const user = c.get('user');
		
		// Get fresh user data from database
		const dbService = getService('database');
		const knex = dbService.getKnex();

		const userData = await knex('users')
			.select('id', 'username', 'email', 'first_name', 'last_name', 'created_at', 'last_login_at')
			.where('id', user.userId)
			.first();

		if (!userData) {
			return c.json({ error: 'User not found' }, 404);
		}

		return c.json({ user: userData });
	} catch (error) {
		console.error('Get user error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

// POST /auth/logout (client-side token removal)
auth.post('/auth/logout', requireAuth(), async (c) => {
	// For JWT tokens, logout is handled client-side by removing the token
	// In a more sophisticated setup, you might maintain a token blacklist
	return c.json({ message: 'Logged out successfully' });
});

// POST /auth/change-password (requires authentication)
auth.post('/auth/change-password', requireAuth(), async (c) => {
	try {
		const user = c.get('user');
		const body = await c.req.json() as { currentPassword: string; newPassword: string };
		const { currentPassword, newPassword } = body;

		if (!currentPassword || !newPassword) {
			return c.json({ error: 'Current password and new password are required' }, 400);
		}

		if (newPassword.length < 6) {
			return c.json({ error: 'New password must be at least 6 characters' }, 400);
		}

		// Get database service
		const dbService = getService('database');
		const knex = dbService.getKnex();

		// Get current user
		const currentUser = await knex('users')
			.where('id', user.userId)
			.first();

		if (!currentUser) {
			return c.json({ error: 'User not found' }, 404);
		}

		// Verify current password
		const isValidPassword = await bcrypt.compare(currentPassword, currentUser.password_hash);
		if (!isValidPassword) {
			return c.json({ error: 'Current password is incorrect' }, 401);
		}

		// Hash new password
		const saltRounds = 12;
		const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

		// Update password
		await knex('users')
			.where('id', user.userId)
			.update({ password_hash: newPasswordHash });

		return c.json({ message: 'Password changed successfully' });
	} catch (error) {
		console.error('Change password error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});
