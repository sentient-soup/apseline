## Setup

```
npm install
npm run dev
```

```
open http://localhost:3001
```

## OAuth Demo

This package includes a minimal OAuth-style flow for local development. It is NOT production-ready, but good enough for end-to-end testing with the Vite app.

### Endpoints

- `POST /oauth/login` — body `{ "username": "demo" }`. Creates a demo session cookie `sid` for authorize step.
- `GET /oauth/authorize` — query `response_type=code&client_id=demo-client&redirect_uri=http://localhost:5173/callback&state=XYZ`. Requires the `sid` cookie; issues an authorization `code` and redirects back.
- `POST /oauth/token` — `application/x-www-form-urlencoded` with `grant_type=authorization_code&code=...&redirect_uri=...&client_id=demo-client&client_secret=demo-secret`. Returns `{ access_token, id_token, token_type, expires_in }`.
- `GET /oauth/userinfo` — Provide `Authorization: Bearer <access_token>`.

### Local client

Pre-seeded client for local testing:

- `client_id`: `demo-client`
- `client_secret`: `demo-secret`
- `redirect_uri`: `http://localhost:5173/callback`

### Run

```
pnpm --filter api dev
```

Server runs on `http://localhost:3001` with CORS enabled for `http://localhost:5173`.

### Notes

- Keys are ephemeral and generated at startup using `jose`. Tokens are valid for 15 minutes.
- Storage for sessions and codes is in-memory; restarting the server clears them.
