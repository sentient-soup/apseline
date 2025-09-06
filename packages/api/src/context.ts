import 'dotenv/config';
import { type AwilixContainer, asValue, createContainer } from 'awilix';
import knex, { type Knex } from 'knex';
import knexConfig from './knexfile';

export interface Context {
	db: Knex;
}

const globals = {
	// TODO memoize
	db: knex(knexConfig)
}

export function createContext(): AwilixContainer<Context> {
	const container = createContainer<Context>();
	container.register({
		db: asValue(globals.db)
	});
	return container;
}

