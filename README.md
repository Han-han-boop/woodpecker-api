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

Import session catalog (from Google Sheet JSON export):

```bash
curl -X POST http://localhost:3000/session-catalog/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"symbol":"XAU-USD","rows":[{"serie":"G001","session_date":"2025-08-22","etat":1},{"serie":"G002","session_date":"2025-08-25","etat":1}]}'
```

List session catalog:

```bash
curl "http://localhost:3000/session-catalog?symbol=XAU-USD" \
  -H "Authorization: Bearer <token>"
```

Generate templates (legacy mode):

```bash
curl -X POST http://localhost:3000/blocks/<blockId>/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"sessionType":"custom","startDate":"2026-02-14","useGitHubUrls":true}'
```

Generate templates with real GitHub data URLs (catalog-driven):

```bash
curl -X POST http://localhost:3000/blocks/<blockId>/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"dataMode":"github_real","sessionType":"london"}'
```

When `dataMode` is `"github_real"`:
- Active `SessionCatalog` rows for the block's symbol are used to generate real raw.githubusercontent.com URLs.
- Each template gets `m1Url`, `m15Url`, `h4Url1`, `h4Url2`, `h4Url3` pointing to actual CSV files.
- URL pattern: `https://raw.githubusercontent.com/Han-han-boop/woodpecker-data/main/<symbol>/<serie>/m1/<date>_m1.csv`
- H4 URLs are fixed per symbol: `.../h4/H4_1.csv`, `H4_2.csv`, `H4_3.csv`
- Fails with `CATALOG_NOT_ENOUGH_ROWS` if not enough active catalog rows.

Legacy template generation behavior:
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

Get next recommended session:

```bash
curl "http://localhost:3000/blocks/<blockId>/next?mode=unseen" \
  -H "Authorization: Bearer <token>"
```

Selection modes:
- `unseen` (default): first template with 0 runs
- `least_runs`: template with fewest runs (tie-break: smallest sessionNumber)
- `oldest`: template with oldest last run (never-run templates have highest priority)

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

Create trade:

```bash
curl -X POST http://localhost:3000/trades \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"runId":"<runId>","direction":"long","entryTsUtc":"2026-02-15T09:30:00Z","entryPrice":42150.5,"slPrice":42000,"tpPrice":42500,"notes":"Breakout entry"}'
```

List trades for a run:

```bash
curl http://localhost:3000/runs/<runId>/trades \
  -H "Authorization: Bearer <token>"
```

Update trade:

```bash
curl -X PATCH http://localhost:3000/trades/<tradeId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"tpPrice":42600,"notes":"Adjusted TP"}'
```

Create journal entry:

```bash
curl -X POST http://localhost:3000/journal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"runId":"<runId>","title":"Session review","notesMd":"## Notes\nClean breakout","result":"win","sumR":1.5,"discipline":8,"confidence":7}'
```

List journal entries for a run:

```bash
curl http://localhost:3000/runs/<runId>/journal \
  -H "Authorization: Bearer <token>"
```

Update journal entry:

```bash
curl -X PATCH http://localhost:3000/journal/<entryId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"discipline":9,"notesMd":"## Updated notes\nRevised after review"}'
```

Add tags to journal entry:

```bash
curl -X POST http://localhost:3000/journal/<entryId>/tags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"tags":["breakout","momentum","A-setup"]}'
```

List tags for journal entry:

```bash
curl http://localhost:3000/journal/<entryId>/tags \
  -H "Authorization: Bearer <token>"
```

Delete tag from journal entry:

```bash
curl -X DELETE http://localhost:3000/journal/<entryId>/tags/momentum \
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
- `SessionCatalog`
- `SessionTemplate`
- `SessionRun`
- `Trade`
- `JournalEntry`
- `JournalTag`

For production deployment migrations:

```bash
npm run prisma:deploy
```
