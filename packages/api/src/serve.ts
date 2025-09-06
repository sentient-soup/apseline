import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializeContext, cleanupContext, getContainer } from './context';
import auth from './auth/auth';

export function createApp(): Hono {
	const app = new Hono();

	const container = getContainer();
	const config = container.resolve('config');

	app.use('*', logger());
	app.use(
		'*',
		cors({
			origin: ['http://localhost:3000'],
			allowHeaders: ['Content-Type', 'Authorization'],
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			exposeHeaders: ['Content-Type'],
			credentials: true,
		}),
	);

	app.get('/health', async (c) => {
		const dbService = container.resolve('database');
		const isHealthy = await dbService.healthCheck();
		
		return c.json({
			status: isHealthy ? 'healthy' : 'unhealthy',
			timestamp: new Date().toISOString(),
			environment: config.nodeEnv,
		}, isHealthy ? 200 : 503);
	});

	app.get('/', (c) => {
		return c.json({
			message: 'Apseline API',
			version: '1.0.0',
			environment: config.nodeEnv,
		});
	});

	app.route('/', auth);

	const router = new Hono();
	
	router.get('/users', async (c) => {
		const dbService = container.resolve('database');
		const knex = dbService.getKnex();
		
		try {
			const users = await knex('users')
				.select('id', 'username', 'email', 'first_name', 'last_name', 'created_at', 'last_login_at')
				.where('is_active', true);
			return c.json({ users });
		} catch (error) {
			console.error('Error fetching users:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	});

	app.route('/api', router);

	// 404 handler
	app.notFound((c) => {
		return c.json({ error: 'Not found' }, 404);
	});

	// Error handler
	app.onError((err, c) => {
		console.error('Unhandled error:', err);
		return c.json({ error: 'Internal server error' }, 500);
	});

	return app;
}

// Start the server
export async function startServer(): Promise<void> {
	try {
		await initializeContext();
		
		// Create the app
		const app = createApp();
		const container = getContainer();
		const config = container.resolve('config');

		// Start the server
		const server = serve(
			{
				fetch: app.fetch,
				port: config.port,
			},
			(info) => {
				console.log(`🚀 Server is running on http://localhost:${info.port}`);
				console.log(`📊 Environment: ${config.nodeEnv}`);
				console.log(`🔗 Health check: http://localhost:${info.port}/health`);
			},
		);

		// Graceful shutdown
		const shutdown = async () => {
			console.log('\n🛑 Shutting down server...');
			server.close();
			await cleanupContext();
			process.exit(0);
		};

		process.on('SIGTERM', shutdown);
		process.on('SIGINT', shutdown);

	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
}
