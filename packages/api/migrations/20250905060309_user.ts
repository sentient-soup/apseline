import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('users', (table) => {
		// Primary key
		table.uuid('id').primary().defaultTo(knex.fn.uuid());
		
		// Basic user information
		table.string('username').unique().notNullable();
		table.string('email').unique().notNullable();
		table.string('password_hash').nullable(); // nullable for OAuth-only users
		table.string('first_name').nullable();
		table.string('last_name').nullable();
		table.string('avatar_url').nullable();
		
		// OAuth provider information
		table.string('provider').nullable(); // 'local', 'google', 'github', etc.
		table.string('provider_id').nullable(); // external provider user ID
		table.jsonb('provider_data').nullable(); // store additional provider-specific data
		
		// Account status
		table.boolean('email_verified').defaultTo(false);
		table.boolean('is_active').defaultTo(true);
		table.timestamp('last_login_at').nullable();
		
		// Timestamps
		table.timestamps(true, true);
		
		// Indexes for performance
		table.index(['email']);
		table.index(['username']);
		table.index(['provider', 'provider_id']);
		table.index(['is_active']);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('users');
}

