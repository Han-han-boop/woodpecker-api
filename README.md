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

## Scripts
- `npm run dev` - start Fastify in watch mode
- `npm run build` - compile TypeScript to `dist`
- `npm run start` - run compiled server
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:migrate` - create/apply development migration
- `npm run prisma:deploy` - apply migrations in non-dev environments
- `npm run prisma:studio` - open Prisma Studio

## Prisma Notes
Schema lives in `prisma/schema.prisma` and includes a simple `User` model.

For production deployment migrations:

```bash
npm run prisma:deploy
```