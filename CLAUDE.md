# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # install dependencies
npm start           # run the API (node index.js)
npm run dev          # run with nodemon (auto-restart)
```

There is no lint or test script configured in this repo.

Database setup (see `db/README_SETUP.md` for full detail):

```bash
mysql -u root -p < db/nags_schema.sql
node scripts/import_nags.js   # loads DATA/*.txt into MySQL (~2M rows, 5-15 min)
```

## Architecture

This is the API server for GlassLogic, an auto-glass shop management app. It is CommonJS Express (`require`, not ESM) and is a separate repo from the frontend (`../frontend` locally, `glasslogic-frontend` remote) — the two only communicate over HTTP, CORS-gated by `CLIENT_URL`.

**Four separate MySQL databases, one per domain**, each with its own connection pool in `config/`:
- `config/db.js` — default DB (`DB_NAME` env var, e.g. `glasslogic`): customers, business types
- `config/gl2015Db.js` — hardcoded to `gl2015m1`: discount schedules (legacy app's database)
- `config/nagsDb.js` — hardcoded to `vehicle_db`: NAGS vehicle/make/model/glass/hardware reference data
- `config/userDb.js` — hardcoded to `user`: employees (`id`, `name`, `total_working_hours`)

Routes import whichever pool matches their domain (e.g. `routes/discounts.js` uses `gl2015Db`, `routes/nagsGlass.js` uses `nagsDb`, `routes/customers.js` and `routes/businessTypes.js` use the default `db`, `routes/employees.js` uses `userDb`). When adding a route, pick the pool by which database actually owns the table, not by convenience.

**Route pattern**: each file in `routes/` is an `express.Router()` doing raw parameterized SQL via `mysql2/promise` (`db.query(sql, params)`) directly against the request handler — no ORM, no service/repository layer, no request validation middleware. Every handler wraps its body in try/catch and responds `res.status(500).json({ error: err.message })` on failure; follow that shape for new routes rather than introducing a different error format.

**`routes/glassParts.js` is a legacy fallback**, mounted at the same `/api` prefix as `routes/nagsGlass.js` (see `index.js`) and queries a much simpler, mostly-placeholder schema (`glass_parts`, `vehicle_makes`, etc.) predating the real NAGS import. New glass/vehicle lookup work belongs in `nagsGlass.js` against `vehicle_db`, not here.

**NAGS data import**: `scripts/import_nags.js` streams the flat files in `DATA/` (gitignored, ~53MB of raw NAGS reference data — not committed) into `vehicle_db`. It defaults to `server/DATA` but honors a `DATA_DIR` env var if the files live elsewhere. Column semantics for NAGS/discount tables (e.g. `discount_amount2`/`labor_rate2` vs the unsuffixed columns in `routes/discounts.js`) reflect quirks of the source legacy schema, not a naming convention — read the inline SQL comments before changing those queries.

**Env**: `.env` is gitignored; `.env.example` documents the required `DB_*`, `PORT`, and `CLIENT_URL` vars and should be kept in sync with any new config values.
