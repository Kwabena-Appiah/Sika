# Sika

Ghana VAT compliance API — auth, businesses, transactions, invoices (VAT Act 1151).

A Node/Express + PostgreSQL backend. `index.html` is a standalone front-end prototype.

## Project layout

```
src/
  server.js            Express app + boot
  db.js                pg pool + withTransaction helper
  migrate.js           applies schema.sql  (npm run migrate)
  config/rates.js      single source of truth for VAT rates
  lib/vat.js           pure VAT engine
  middleware/auth.js   requireAuth / loadBusiness / requireWrite
  routes/              auth, businesses, transactions, invoices
schema.sql             PostgreSQL schema
```

## Environment variables

Copy `.env.example` to `.env` for local dev, or set these in your host's dashboard.

| Var              | Required | Default | Notes                                                       |
| ---------------- | -------- | ------- | ----------------------------------------------------------- |
| `DATABASE_URL`   | yes      | —       | Postgres connection string. SSL auto-enabled off localhost. |
| `JWT_SECRET`     | yes      | —       | Signs/verifies JWTs. Server exits at boot if unset.         |
| `JWT_EXPIRES_IN` | no       | `7d`    | Token lifetime.                                             |
| `PORT`           | no       | `4000`  | Listen port.                                                |
| `CORS_ORIGIN`    | no       | `*`     | Allowed origin for the front end.                          |

## Run locally

```bash
npm install
npm run migrate        # apply schema.sql to DATABASE_URL (run once)
npm start              # or: npm run dev  (watch mode)
```

Health check: `GET /health` -> `{ "ok": true }`

## Deploy

1. Provision a PostgreSQL database (Neon, Render, etc.).
2. Set `DATABASE_URL` and `JWT_SECRET` in the host's environment.
3. Install command: `npm install`
4. Start command: `npm start`
5. Run the migration once against the production DB: `npm run migrate`.

`node_modules/` is git-ignored — the host installs dependencies from `package-lock.json`.
