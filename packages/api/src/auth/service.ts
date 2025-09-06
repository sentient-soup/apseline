import { hash } from 'node:crypto';
import type { Knex } from 'knex';
import type { Context } from '../context';
import type { User } from './types';
import { decrypt, encrypt } from './utils';

export class AuthService {
  private db: Knex;

  constructor({ db }: Context) {
    this.db = db;
  }

  async register({ username, email, password }: any) {
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const existingUser = await this.db('users')
      .where('username', username)
      .orWhere('email', email)
      .first();

    if (existingUser) {
      throw new Error('Username or email already exists');
    }
    const passwordHash = await hash('sha512', password);
    const user = (await this.db('users')
      .insert({
        username,
        email,
        password: passwordHash,
      })
      .returning('*')
      .first()) as User;
    return user;
  }

  async login({ username, password }: any) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const user = await this.db('users')
      .where('username', username)
      .andWhere('is_active', true)
      .first();
    if (!user) {
      throw new Error('Invalid credentials');
    }
    const hashed = await hash('sha512', password);
    if (hashed !== user.password_hash) {
      throw new Error('Invalid credentials');
    }
    await this.db('users')
      .where('id', user.id)
      .update({ last_login_at: this.db.fn.now() });

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

  // async changePassword() {

  //     try {
  //         const user = c.get('user');
  //         const body = await c.req.json() as { currentPassword: string; newPassword: string };
  //         const { currentPassword, newPassword } = body;

  //         if (!currentPassword || !newPassword) {
  //             return c.json({ error: 'Current password and new password are required' }, 400);
  //         }

  //         if (newPassword.length < 6) {
  //             return c.json({ error: 'New password must be at least 6 characters' }, 400);
  //         }

  //         // Get database service
  //         const dbService = getService('database');
  //         const knex = dbService.getKnex();

  //         // Get current user
  //         const currentUser = await knex('users')
  //             .where('id', user.userId)
  //             .first();

  //         if (!currentUser) {
  //             return c.json({ error: 'User not found' }, 404);
  //         }

  //         // Verify current password
  //         const isValidPassword = await bcrypt.compare(currentPassword, currentUser.password_hash);
  //         if (!isValidPassword) {
  //             return c.json({ error: 'Current password is incorrect' }, 401);
  //         }

  //         // Hash new password
  //         const saltRounds = 12;
  //         const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  //         // Update password
  //         await knex('users')
  //             .where('id', user.userId)
  //             .update({ password_hash: newPasswordHash });

  //         return c.json({ message: 'Password changed successfully' });
  //     } catch (error) {
  //         console.error('Change password error:', error);
  //         return c.json({ error: 'Internal server error' }, 500);
  //     }
  // }
}
