import 'dotenv/config';
import type { Knex } from "knex";


const config: Knex.Config = {
  client: "postgresql",
  connection: {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
  },
  pool: {
    min: 1,
    max: 2
  },
  migrations: {
    tableName: "knex_migrations"
  }
};

export default config;
