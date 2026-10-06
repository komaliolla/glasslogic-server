# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # install dependencies
npm start           # run the API (node index.js)
npm run dev          # run with nodemon (auto-restart)
```

There is no lint or test script configured in this repo.

Database setup lives in the sibling `../database` folder (see `../database/README.md` for full detail):

```bash
cd ../database && npm install
mysql -u root -p < schema/nags_schema.sql
npm run import-nags   # loads data/*.txt into MySQL (~2M rows, 5-15 min)
```

## Architecture

This is the API server for GlassLogic, an auto-glass shop management app. It is CommonJS Express (`require`, not ESM) and is a separate repo from the frontend (`../frontend` locally, `glasslogic-frontend` remote) — the two only communicate over HTTP, CORS-gated by `CLIENT_URL`.

**Four separate MySQL databases, one per domain**, each with its own connection pool in the sibling `../database/config/` folder (not inside `server/` — see "Database package" below):
- `config/db.js` — default DB (`DB_NAME` env var, e.g. `glasslogic`): customers, business types, schedule_bookings, call_list
- `config/gl2015Db.js` — hardcoded to `gl2015m1`: discount schedules (legacy app's database)
- `config/nagsDb.js` — hardcoded to `vehicle_db`: NAGS vehicle/make/model/glass/hardware reference data
- `config/userDb.js` — hardcoded to `user`: employees (`id`, `name`, `total_working_hours`), shop_settings (singleton row, id fixed at 1), user_credentials (login for a subset of employees — see Auth below)

Routes import whichever pool matches their domain (e.g. `routes/discounts.js` uses `gl2015Db`, `routes/nagsGlass.js` uses `nagsDb`, `routes/customers.js` and `routes/businessTypes.js` use the default `db`, `routes/employees.js`, `routes/shopSettings.js`, `routes/auth.js`, and `routes/userCredentials.js` use `userDb`, `routes/schedule.js` and `routes/callList.js` use the default `db`). When adding a route, pick the pool by which database actually owns the table, not by convenience.

**Auth**: `user_credentials` (in the `user` DB) holds one row per employee who has login access — `employee_id` (FK to `employees.id`, `ON DELETE CASCADE`), `username`, `password_hash` (bcrypt, never plaintext), plus RBAC additions `role_id` (FK to `roles.id`), `is_active`, `last_login_at` (see `../database/schema/rbac_schema.sql`). `routes/auth.js` (`POST /api/auth/login`) checks credentials, rejects inactive/roleless accounts, and returns `{token, user: {employeeId, name, role, permissions}}` — `token` is a JWT (`JWT_SECRET`/`JWT_EXPIRES_IN` in `.env`) carrying the role and flattened permission list, no separate refresh token yet. `../database/scripts/reset_password.js` is a CLI escape hatch (`npm run reset-password -- [--employee-id <id>] <username> <newPassword>` from `database/`) for when every login is forgotten and the in-app reset UI is unreachable — it writes straight to `user_credentials`, bypassing the API. `../database/scripts/seed_test_users.js` creates one test login per role (Technician/CSR/Manager) for exercising RBAC.

**RBAC**: three fixed roles (Technician, CSR, Manager) seeded into `roles`; named permissions live in `permissions`; `role_permissions` is the actual source of truth for who can do what (Manager's row set is seeded explicitly with every permission — never special-cased in code as an implicit all-access role). `middleware/authenticate.js` verifies the JWT and sets `req.user`; `middleware/authorize(permission)` checks `req.user.permissions` and must run after it. Protected routers apply both via `router.use(authenticate, authorize(...))` or per-route (see `routes/schedule.js`, `routes/callList.js`, `routes/shopSettings.js`, `routes/userCredentials.js` — the last requires `user:manage` and needs a Manager JWT to call at all now). `middleware/auditLog.js` writes to `user_audit_log` (fire-and-forget) — called on every role change and account activation/deactivation in `routes/userCredentials.js`; there's no EDI-send route yet to log against. `routes/employees.js`, `routes/customers.js`, `routes/discounts.js`, `routes/nagsGlass.js`, `routes/glassParts.js`, `routes/invoices.js`, and `routes/businessTypes.js` are not yet gated by any permission — add `authenticate`/`authorize` to a router the same way when RBAC should cover it. Accounts created before this migration have `role_id = NULL` and cannot log in until a Manager assigns them a role.

**Scheduling data**: `schedule_bookings` and `call_list` both live in the default `db` (not `nagsDb`) and both carry `vehicle_year`/`vehicle_make`/`vehicle_model`/`vehicle_body_style` columns — plain strings, not foreign keys into `vehicle_db`'s NAGS tables, since the two live in separate MySQL databases. `call_list` (`routes/callList.js`, the frontend's "Calls Schedule" page) additionally has a free-text `note` column.

**Route pattern**: each file in `routes/` is an `express.Router()` doing raw parameterized SQL via `mysql2/promise` (`db.query(sql, params)`) directly against the request handler — no ORM, no service/repository layer, no request validation middleware. Every handler wraps its body in try/catch and responds `res.status(500).json({ error: err.message })` on failure; follow that shape for new routes rather than introducing a different error format.

**`routes/glassParts.js` is a legacy fallback**, mounted at the same `/api` prefix as `routes/nagsGlass.js` (see `index.js`) and queries a much simpler, mostly-placeholder schema (`glass_parts`, `vehicle_makes`, etc.) predating the real NAGS import. New glass/vehicle lookup work belongs in `nagsGlass.js` against `vehicle_db`, not here.

**NAGS data import**: `../database/scripts/import_nags.js` streams the flat files in `../database/data/` (gitignored, ~53MB of raw NAGS reference data — not committed) into `vehicle_db`. It defaults to `database/data` but honors a `DATA_DIR` env var if the files live elsewhere. Column semantics for NAGS/discount tables (e.g. `discount_amount2`/`labor_rate2` vs the unsuffixed columns in `routes/discounts.js`) reflect quirks of the source legacy schema, not a naming convention — read the inline SQL comments before changing those queries.

**Database package**: schema SQL, the raw NAGS data dump, the four connection pools, and setup/seed scripts all live in the sibling `../database` folder (its own `package.json`/`node_modules`/`.env`, mirroring how `server`/`frontend` are separate — see `../database/README.md`). Every route file and `middleware/auditLog.js` reaches across with `require('../../database/config/<pool>')`; this is the one place `server/` isn't fully self-contained. Because `../database`'s scripts run standalone (cwd = `database/`) while the server runs from `server/`, `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD` must be kept in sync across both `.env` files.

**Env**: `.env` is gitignored; `.env.example` documents the required `DB_*`, `PORT`, and `CLIENT_URL` vars and should be kept in sync with any new config values.
