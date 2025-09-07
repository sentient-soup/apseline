import { hash } from 'node:crypto';
import type { Knex } from 'knex';
import type { Container } from '../container';
import type { User } from './types';
import { decrypt, encrypt } from './utils';

export class AuthService {
  private db: Knex;

  constructor({ db }: Container) {
    this.db = db;
  }

  async register({ username, email, password }: any) {
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }
    const existingUser = await this.db('users')
      .where('username', username)
      .orWhere('email', email)
      .first();
    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    const passwordHash = await hash('sha512', password);
    const user = await this.db('users')
      .insert({
        username,
        email,
        password: passwordHash,
      })
      .returning('*');
    return user;
  }

  async login({ username, password }: any) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const user = await this.db('users').where('username', username).first();
    if (!user) {
      throw new Error('Invalid credentials');
    }
    const hashed = await hash('sha512', password);
    if (hashed !== user.password) {
      console.log(hashed);
      console.log(user.password);
      throw new Error('Invalid credentials');
    }
    await this.db('users')
      .where('id', user.id)
      .update({ lastLogin: this.db.fn.now() });

    const token = await encrypt(user.id, user.username);

    return {
      user,
      token,
    };
  }

  async whoami({ token }: any) {
    const { userId } = (await decrypt(token)) ?? {};
    if (!userId) throw new Error('Failed to decrypt token');
    const user = await this.db('users')
      .select('id', 'username', 'email', 'created', 'lastLogin')
      .where('id', userId)
      .first();

    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async changePassword({ token, currentPassword, newPassword }: any) {
    const { userId } = (await decrypt(token)) ?? {};
    if (!userId) {
      throw new Error('Failed to decrypt token');
    }
    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required');
    }

    const user = await this.db('users').where('id', userId).first();
    if (!user) {
      throw new Error('User not found');
    }

    const hashed = await hash('sha512', currentPassword);
    if (hashed !== user.hash) {
      throw new Error('Invalid credentials');
    }

    const newPasswordHash = await hash('sha512', newPassword);
    await this.db('users')
      .where('id', user.id)
      .update({ password: newPasswordHash });

    return { message: 'Password changed successfully' };
  }
}
