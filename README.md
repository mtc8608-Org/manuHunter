# manuHunter

![React](https://img.shields.io/badge/React-Ionic-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

A job-search personal management app: track every application, its status and responses, and store the tailored CV you sent for each role. Built on the [manuSpine](https://github.com/mtc8608/manuSpine) full-stack template (React/Ionic, Node/GraphQL, PostgreSQL, MinIO, Python/FastAPI, Docker).

> **Fork of [mtc8608/manuSpine](https://github.com/mtc8608/manuSpine).** manuSpine is the reusable full-stack template; manuHunter is this specific application built on top of it. Framework-level fixes flow up to manuSpine; job-search features live here.

---

## What manuHunter adds

A **jobs domain** on top of the template:

- **Applications tracker** — one record per application with company, role, location, source, salary, contact, the pasted job description, and free-form notes.
- **Status pipeline** — `draft → applied → screening → interview → offer / rejected / ghosted / withdrawn`, filterable in the list.
- **CV artifact store** — attach the tailored CV (or cover letter / JD) to each application; files are stored in MinIO and downloadable per application.
- **Response timeline** — log responses, interviews, and status changes against each application.

Implemented as: `init-scripts/02-init-jobs.sql`, `nodejs/schema/resolvers/jobs/`, `nodejs/routes/jobs/`, and `pwa/src/pages/jobs/Applications.tsx`.

---

## Screenshots

| Sign In | Surveys | Content |
|---------|---------|---------|
| ![Sign In](pwa/public/screenshots/app-signin.png) | ![Surveys](pwa/public/screenshots/app-surveys-questions.png) | ![Content](pwa/public/screenshots/app-content-build.png) |

| Stats | Files | Config |
|-------|-------|--------|
| ![Stats](pwa/public/screenshots/app-surveys-stats.png) | ![Files](pwa/public/screenshots/app-files.png) | ![Config](pwa/public/screenshots/app-config.png) |

---

## What's included

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | React + Ionic + Vite | SPA with shell components, routing, auth |
| Backend | Node.js + Express + GraphQL | API, auth, business logic |
| DB | PostgreSQL 16 | Relational store; JSONB for flexible component data |
| Storage | MinIO | Object storage for files / images |
| Computation | Python + FastAPI | Domain-specific compute; Node.js proxies here |

### Framework features

- **Component tree system** — UI structure (forms, inputs, charts) stored as JSONB nodes. Rendered dynamically by `FormRenderer` / `TreeEditor`.
- **Survey system** — parallel component tree for building and running surveys with answer storage.
- **Content / CMS** — hierarchical content pages with HTML, Image, HTML+Image, and LaTeX card types. Editable from the Backoffice.
- **Files** — MinIO-backed file upload, listing, and description management.
- **Auth** — JWT-based login, roles (`admin` / `user`), change-password.
- **Shell components** — `SplitPageLayout`, `TabPanel`, `ResourcePanel`, `DataTable`, `ModalShell`, `EmptyState`, `TreeEditor`.

---

## Running

```bash
cp .env.example .env          # edit credentials
./run                         # start all services
./run reset                   # wipe DB + MinIO and restart
./run rebuild <service>       # rebuild after Dockerfile changes
./run down                    # stop everything
```

Service URLs:
- Frontend: http://localhost:8100
- GraphQL: http://localhost:3000/graphql
- Python: http://localhost:5000

---

## Adding a domain

A domain is a vertical slice of functionality (e.g. finance, medical, e-commerce). Each domain adds:

### 1. DB tables — `init-scripts/02-init-<domain>.sql`

```sql
CREATE TABLE my_things (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

File is picked up alphabetically by postgres on first start. Run `./run reset` to apply.

### 2. Node.js routes — `nodejs/routes/<domain>/things.js`

```js
const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
// ... REST endpoints
module.exports = router;
```

Register in `nodejs/backend.js`:
```js
// [MY DOMAIN]
server.use('/api', require('./routes/<domain>/things'));
```

### 3. GraphQL resolvers — `nodejs/schema/resolvers/<domain>/things.js`

```js
module.exports = {
  queries: { /* ... */ },
  mutations: { /* ... */ },
};
```

Register in `nodejs/schema/index.js`:
```js
const thingResolvers = require('./resolvers/<domain>/things');
// add to Query fields and Mutation fields
```

### 4. Python routes (optional) — `python/api/domains/<domain>/`

```python
from fastapi import APIRouter
router = APIRouter()

@router.get("/<domain>/health")
def domain_health():
    return {"ok": True}
```

Register in `python/api/main.py`:
```python
from .domains.<domain>.routes import router as domain_router
app.include_router(domain_router)
```

### 5. Frontend — `pwa/src/pages/<domain>/` and `pwa/src/domains/<domain>/constants.ts`

- Add page files following the `SplitPageLayout` pattern (see existing pages).
- Add constants to `pwa/src/constants.ts` marked `// [MY DOMAIN]`.
- Register routes in `pwa/src/App.tsx` and nav in `pwa/src/components/shell/Menu.tsx`.

---

## Getting started

```bash
git clone https://github.com/mtc8608-Org/manuHunter.git
cd manuHunter
cp .env.example .env          # set your credentials
./run                         # start all services
```

Then sign in at http://localhost:8100 with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Relationship to manuSpine

manuHunter is a fork of the [manuSpine](https://github.com/mtc8608/manuSpine) template. To pull framework updates from the parent:

```bash
git remote add upstream https://github.com/mtc8608/manuSpine.git
git fetch upstream
git merge upstream/main
```
