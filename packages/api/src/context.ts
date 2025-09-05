import 'dotenv/config';
import { type AwilixContainer, asClass, createContainer } from 'awilix';
import knex, { type Knex } from 'knex';
import knexConfig from '../knexfile';

// Types for dependency injection
export interface Container {
	database: Knex;
	config: {
		port: number;
		nodeEnv: string;
		jwtSecret: string;
		database: typeof knexConfig.connection;
	};
}

// Database service
class DatabaseService {
	private knex: Knex;

	constructor() {
		this.knex = knex(knexConfig);
	}

	getKnex(): Knex {
		return this.knex;
	}

	async healthCheck(): Promise<boolean> {
		try {
			await this.knex.raw('SELECT 1');
			return true;
		} catch (error) {
			console.error('Database health check failed:', error);
			return false;
		}
	}

	async close(): Promise<void> {
		await this.knex.destroy();
	}
}

// Configuration service
class ConfigService {
	get port(): number {
		return Number.parseInt(process.env.PORT || '3001', 10);
	}

	get nodeEnv(): string {
		return process.env.NODE_ENV || 'development';
	}

	get jwtSecret(): string {
		return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
	}

	get database() {
		return knexConfig.connection;
	}
}

// Create and configure the container
export function createAppContainer(): AwilixContainer<Container> {
	const container = createContainer<Container>();

	// Register services
	container.register({
		// Database
		database: asClass(DatabaseService).singleton(),

		// Configuration
		config: asClass(ConfigService).singleton(),
	});

	return container;
}

// Global container instance
let globalContainer: AwilixContainer<Container> | null = null;

export function getContainer(): AwilixContainer<Container> {
	if (!globalContainer) {
		globalContainer = createAppContainer();
	}
	return globalContainer;
}

export function setContainer(container: AwilixContainer<Container>): void {
	globalContainer = container;
}

// Helper to get services from container
export function getService<T extends keyof Container>(
	serviceName: T,
): Container[T] {
	const container = getContainer();
	return container.resolve(serviceName);
}

// Initialize container and run startup tasks
export async function initializeContext(): Promise<AwilixContainer<Container>> {
	const container = createAppContainer();
	setContainer(container);

	// Initialize database connection
	const dbService = container.resolve('database');
	const isHealthy = await dbService.healthCheck();

	if (!isHealthy) {
		throw new Error('Database connection failed');
	}

	console.log('✅ Database connection established');
	console.log('✅ Application context initialized');

	return container;
}

// Cleanup function
export async function cleanupContext(): Promise<void> {
	if (globalContainer) {
		const dbService = globalContainer.resolve('database');
		await dbService.close;
		console.log('✅ Database connection closed');
	}
}
