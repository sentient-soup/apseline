import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('users', (table) => {
		table.uuid('id').primary().defaultTo(knex.fn.uuid());
		table.string('username').unique().notNullable();
		table.string('email').unique().notNullable();
		table.timestamp('created').notNullable().defaultTo(knex.fn.now());
		table.string('password').notNullable();
		table.string('avatarUrl').nullable();
		table.timestamp('lastLogin').nullable();
		
		table.index(['email']);
		table.index(['username']);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('users');
}

