import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializeContext, cleanupContext, getContainer } from './context';
import oauth from './oauth';

// Create the main application
export function createApp(): Hono {
	const app = new Hono();

	// Get container for dependency injection
	const container = getContainer();
	const config = container.resolve('config');

	// Middleware
	app.use('*', logger());
	app.use(
		'*',
		cors({
			origin: ['http://localhost:5173'],
			allowHeaders: ['Content-Type', 'Authorization'],
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			exposeHeaders: ['Content-Type'],
			credentials: true,
		}),
	);

	// Health check endpoint
	app.get('/health', async (c) => {
		const dbService = container.resolve('database');
		const isHealthy = await dbService.healthCheck();
		
		return c.json({
			status: isHealthy ? 'healthy' : 'unhealthy',
			timestamp: new Date().toISOString(),
			environment: config.nodeEnv,
		}, isHealthy ? 200 : 503);
	});

	// API routes
	app.get('/', (c) => {
		return c.json({
			message: 'Apseline API',
			version: '1.0.0',
			environment: config.nodeEnv,
		});
	});

	// Mount OAuth routes
	app.route('/', oauth);

	// API v1 routes (for future expansion)
	const v1 = new Hono();
	
	// Example: Users endpoint
	v1.get('/users', async (c) => {
		const dbService = container.resolve('database');
		const knex = dbService.getKnex();
		
		try {
			const users = await knex('users').select('id', 'username', 'email', 'created_at');
			return c.json({ users });
		} catch (error) {
			console.error('Error fetching users:', error);
			return c.json({ error: 'Internal server error' }, 500);
		}
	});

	// Mount v1 routes
	app.route('/api/v1', v1);

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
		// Initialize application context
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
