import {
  type AwilixContainer,
  asClass,
  asValue,
  createContainer,
} from 'awilix';
import knex, { type Knex } from 'knex';
import memoize from 'memoize';
import knexConfig from '../knexfile';
import { AuthService } from './auth/service';

const globals = {
  db: memoize(() => knex(knexConfig)),
};

export interface Container {
  db: Knex;
  auth: AuthService;
}

export function buildContainer(): AwilixContainer<Container> {
  const container = createContainer<Container>();
  container.register({
    db: asValue(globals.db()),
    auth: asClass(AuthService),
  });
  return container;
}
