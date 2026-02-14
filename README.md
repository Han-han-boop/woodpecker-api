# Woodpecker API Skeleton

Production-ready starter for a Fastify + TypeScript API with Prisma and Postgres.

## Tech
- Node.js + TypeScript
- Fastify
- Zod (env validation)
- Prisma ORM
- Postgres (Docker Compose)

## Prerequisites
- Node.js 20+
- Docker + Docker Compose

## Environment
Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

Main variables:
- `INVITE_CODE_REQUIRED` (`true`/`false`, default `true`)
- `AUTH_DISABLED` (`true`/`false`, default `false`). When `true`, protected routes use a temporary dev user:
  - `id`: `dev-user`
  - `email`: `dev@local`

## Local Run
1. Start Postgres

```bash
docker compose up -d
```

2. Install dependencies

```bash
npm install
```

3. Generate Prisma client and run migrations

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

4. Run dev server

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"ok":true}
```

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","inviteCode":"WOODPECKER-1"}'
```

Get current user:

```bash
curl http://localhost:3000/me -H "Authorization: Bearer <token>"
```

Create block:

```bash
curl -X POST http://localhost:3000/blocks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Momentum Block","symbol":"BTCUSDT","sessionCount":5}'
```

Generate templates:

```bash
curl -X POST http://localhost:3000/blocks/<blockId>/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"sessionType":"custom","startDate":"2026-02-14","useGitHubUrls":true}'
```

Template generation behavior:
- If `startDate` is provided, dates are assigned sequentially (`+1 day`) from that date.
- If `startDate` is omitted, template `date` is `null`.
- If `useGitHubUrls` is `true`, URLs are set to:
  - `https://github.com/woodpecker-api/session-assets/<templateId>/m1`
  - `https://github.com/woodpecker-api/session-assets/<templateId>/m15`
  - `https://github.com/woodpecker-api/session-assets/<templateId>/h4`

List templates of a block:

```bash
curl http://localhost:3000/blocks/<blockId>/templates \
  -H "Authorization: Bearer <token>"
```

Create run:

```bash
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"templateId":"tpl_<blockId>_001"}'
```

End run:

```bash
curl -X POST http://localhost:3000/runs/<runId>/end \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"result":"win","sumR":1.5}'
```

List runs for a template:

```bash
curl http://localhost:3000/templates/<templateId>/runs \
  -H "Authorization: Bearer <token>"
```

## Scripts
- `npm run dev` - start Fastify in watch mode
- `npm run build` - compile TypeScript to `dist`
- `npm run start` - run compiled server
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:migrate` - create/apply development migration
- `npm run prisma:deploy` - apply migrations in non-dev environments
- `npm run prisma:studio` - open Prisma Studio
- `npm run prisma:seed` - seed invite codes (`WOODPECKER-1` to `WOODPECKER-5`)

## Prisma Notes
Schema lives in `prisma/schema.prisma` and includes:
- `User`
- `InviteCode`
- `Block`
- `SessionTemplate`
- `SessionRun`

For production deployment migrations:

```bash
npm run prisma:deploy
```
