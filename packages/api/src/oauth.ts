import { Hono } from 'hono';
import { type JWTPayload, SignJWT, generateKeyPair, jwtVerify } from 'jose';

type Client = {
	id: string;
	secret: string;
	redirectUris: string[];
};

type User = {
	id: string;
	username: string;
};

const oauth = new Hono();

// In-memory stores for demo purposes only
const clients = new Map<string, Client>();
const users = new Map<string, User>();
const sessions = new Map<string, string>(); // sessionId -> userId
const authCodes = new Map<
	string,
	{ clientId: string; redirectUri: string; userId: string; expiresAt: number }
>();

// Demo seed
clients.set('demo-client', {
	id: 'demo-client',
	secret: 'demo-secret',
	redirectUris: ['http://localhost:5173/callback'],
});
users.set('u1', { id: 'u1', username: 'demo' });

// Key material (generated at startup for demo). In production, use persistent keys.
let privateKeyPromise: Promise<CryptoKey>;
let publicKeyPromise: Promise<CryptoKey>;
({ privateKeyPromise, publicKeyPromise } = ((): {
	privateKeyPromise: Promise<CryptoKey>;
	publicKeyPromise: Promise<CryptoKey>;
} => {
	const pair = generateKeyPair('RS256');
	return {
		privateKeyPromise: pair.then((p) => p.privateKey),
		publicKeyPromise: pair.then((p) => p.publicKey),
	};
})());

function generateId(prefix: string = 'id'): string {
	return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function isRedirectAllowed(client: Client, uri: string): boolean {
	try {
		const given = new URL(uri);
		return client.redirectUris.some((u) => {
			try {
				const allowed = new URL(u);
				return (
					allowed.origin === given.origin && allowed.pathname === given.pathname
				);
			} catch {
				return false;
			}
		});
	} catch {
		return false;
	}
}

async function issueTokens(
	user: User,
	clientId: string,
): Promise<{
	access_token: string;
	id_token: string;
	token_type: 'Bearer';
	expires_in: number;
}> {
	const privateKey = await privateKeyPromise;
	const now = Math.floor(Date.now() / 1000);
	const expiresIn = 60 * 15;
	const basePayload: JWTPayload = {
		sub: user.id,
		aud: clientId,
		iss: 'http://localhost:3001',
		iat: now,
		exp: now + expiresIn,
	};
	const accessToken = await new SignJWT({
		...basePayload,
		scope: 'openid profile',
	})
		.setProtectedHeader({ alg: 'RS256' })
		.sign(privateKey);
	const idToken = await new SignJWT({ ...basePayload, username: user.username })
		.setProtectedHeader({ alg: 'RS256' })
		.sign(privateKey);
	return {
		access_token: accessToken,
		id_token: idToken,
		token_type: 'Bearer',
		expires_in: expiresIn,
	};
}

// POST /oauth/login -> { username } returns a sessionId cookie for demo
oauth.post('/oauth/login', async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as { username?: string };
	const username = body.username || 'demo';
	const user =
		Array.from(users.values()).find((u) => u.username === username) ||
		users.get('u1')!;
	const sessionId = generateId('sess');
	sessions.set(sessionId, user.id);
	c.header('Set-Cookie', `sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
	return c.json({ ok: true, user });
});

// GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&state=...
oauth.get('/oauth/authorize', (c) => {
	const url = new URL(c.req.url);
	const responseType = url.searchParams.get('response_type');
	const clientId = url.searchParams.get('client_id') || '';
	const redirectUri = url.searchParams.get('redirect_uri') || '';
	const state = url.searchParams.get('state') || '';

	if (responseType !== 'code') return c.text('unsupported_response_type', 400);
	const client = clients.get(clientId);
	if (!client) return c.text('invalid_client', 400);
	if (!isRedirectAllowed(client, redirectUri))
		return c.text('invalid_redirect_uri', 400);

	const cookie = c.req.header('cookie') || '';
	const sid = cookie
		.split(';')
		.map((v) => v.trim())
		.find((v) => v.startsWith('sid='))
		?.split('=')[1];
	const userId = sid ? sessions.get(sid) : undefined;
	if (!userId) {
		const redirect = new URL(redirectUri);
		redirect.searchParams.set('error', 'login_required');
		if (state) redirect.searchParams.set('state', state);
		return c.redirect(redirect.toString(), 302);
	}

	const code = generateId('code');
	authCodes.set(code, {
		clientId,
		redirectUri,
		userId,
		expiresAt: Date.now() + 60_000,
	});
	const out = new URL(redirectUri);
	out.searchParams.set('code', code);
	if (state) out.searchParams.set('state', state);
	return c.redirect(out.toString(), 302);
});

// POST /oauth/token (application/x-www-form-urlencoded)
oauth.post('/oauth/token', async (c) => {
	const contentType = c.req.header('content-type') || '';
	if (!contentType.includes('application/x-www-form-urlencoded')) {
		return c.json(
			{ error: 'invalid_request', error_description: 'expected form body' },
			400,
		);
	}
	const form = await c.req.formData();
	const grantType = (form.get('grant_type') as string) || '';
	const code = (form.get('code') as string) || '';
	const redirectUri = (form.get('redirect_uri') as string) || '';
	const clientId = (form.get('client_id') as string) || '';
	const clientSecret = (form.get('client_secret') as string) || '';

	if (grantType !== 'authorization_code')
		return c.json({ error: 'unsupported_grant_type' }, 400);
	const client = clients.get(clientId);
	if (!client || client.secret !== clientSecret)
		return c.json({ error: 'invalid_client' }, 401);
	const record = authCodes.get(code);
	if (!record) return c.json({ error: 'invalid_grant' }, 400);
	if (record.expiresAt < Date.now())
		return c.json(
			{ error: 'invalid_grant', error_description: 'expired' },
			400,
		);
	if (record.clientId !== clientId)
		return c.json({ error: 'invalid_grant' }, 400);
	if (record.redirectUri !== redirectUri)
		return c.json({ error: 'invalid_grant' }, 400);

	authCodes.delete(code);
	const user = users.get(record.userId)!;
	const tokens = await issueTokens(user, clientId);
	return c.json({ ...tokens });
});

// GET /oauth/userinfo (Bearer token)
oauth.get('/oauth/userinfo', async (c) => {
	const auth = c.req.header('authorization') || '';
	const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
	if (!token) return c.json({ error: 'invalid_token' }, 401);
	try {
		const publicKey = await publicKeyPromise;
		const { payload } = await jwtVerify(token, publicKey, {
			issuer: 'http://localhost:3001',
		});
		const user = users.get(payload.sub as string);
		if (!user) return c.json({ error: 'invalid_token' }, 401);
		return c.json({ sub: user.id, username: user.username });
	} catch (e) {
		return c.json({ error: 'invalid_token' }, 401);
	}
});

export default oauth;
