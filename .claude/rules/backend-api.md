---
paths:
  - "nodejs/**"
---

# Backend API conventions

How the Node backend is organised and secured. Applies to every edit under `nodejs/`, not just new endpoints (procedure for new ones: the `new-api` skill).

## Module layout

- **GraphQL resolvers** — `schema/resolvers/<domain>/<things>.js` exporting `{ queries, mutations }`. Merged into `schema/index.js`'s `Query`/`Mutation` field spreads under a `// [DOMAIN]` banner comment. GraphQL output types live in `schema/types.js`.
- **REST routes** — `routes/<domain>/<things>.js` exporting an express router, registered in `backend.js` with `server.use('/api', require('./routes/<domain>/<things>'))` under the same `// [DOMAIN]` banner.
- GraphQL for entity CRUD; REST only for what GraphQL handles badly: file upload/download, binary/PDF streaming, orchestration endpoints that call Python (`routes/framework/files.js`, `routes/cv/compile.js`).

## Auth model (how it actually works)

- A JWT middleware in `backend.js` attaches `req.user` (or `null`) to every request and always continues; nothing is blocked at the middleware level.
- **REST routes enforce their own auth**: start handlers with `if (!req.user) return res.status(401)...`, and owner/admin checks explicitly (see `files.js`, `compile.js`'s `loadOwnedDocument`).
- **GraphQL enforcement** happens in `schema/index.js` using the `permissions.js` lists, by operation *name*, and is **identical for queries and mutations**: `user` list → any valid JWT; `public` list → open; everything else → admin only. An operation left out of both lists is admin-only by default — including queries.
- Because admin is the default, adding an operation is not done until its name is placed in the right `permissions.js` tier with a `// [DOMAIN]` comment. Anything you put in the `user` tier must still owner-scope inside the resolver (admin-tier default protects against cross-role access, not cross-user access).

## The owner-scoping invariant (non-negotiable)

Every operation in the `user` tier must scope rows by owner inside the resolver: non-admin gets `WHERE user_id = ctx.user.id` (or `owner_id`); admin sees all. Reads scope the SELECT or check the fetched row; writes append the scope to the UPDATE/DELETE `WHERE` and error with "not found or not authorised" when zero rows match. `schema/resolvers/jobs/applications.js` is the reference implementation.

## Resolver/route style

- Parameterised `pool.query` only, with explicit casts (`$1::uuid`, `$n::date`). Never interpolate values into SQL.
- Dates/timestamps formatted in SQL with `to_char(... AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` so the frontend gets strings directly (`APP_COLS` pattern).
- Dynamic create/update built from a `WRITABLE` column whitelist — never spread client args into columns.
- One `console.log('-> <Action>', ...)` line at the top of each resolver/handler.
- Errors: resolvers `throw new Error(...)`; REST handlers `res.status(4xx|500).json({ error })` and `console.error` the cause.

## Frontend access

All calls go through `pwa/src/services/Api.ts` — the `gql` helper for GraphQL, the shared `http` axios instance for REST (auth header injected automatically). Export named functions in the domain's section; pages never use raw `fetch`/`axios`.
