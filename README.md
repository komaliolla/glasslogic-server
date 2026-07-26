# GlassLogic — API Server

Node.js + Express REST API for GlassLogic, an auto-glass shop management app. Serves customers, business types, discount schedules, and NAGS vehicle/glass/hardware lookup data to the [GlassLogic frontend](../frontend).

## Tech stack

- Node.js + Express
- MySQL (`mysql2`)
- dotenv, cors

## Prerequisites

- Node.js 18+
- MySQL 8+

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Create the database(s) and import reference data — see [db/README_SETUP.md](db/README_SETUP.md) for full steps. In short:

   ```bash
   mysql -u root -p < db/nags_schema.sql
   node scripts/import_nags.js   # imports the NAGS DATA/*.txt files (~2M rows, 5-15 min)
   ```

3. Configure environment

   ```bash
   cp .env.example .env
   ```

   Fill in your MySQL credentials and port. Never commit `.env`.

4. Run the server

   ```bash
   npm start        # production
   npm run dev      # nodemon, auto-restart on change
   ```

   The API listens on `http://localhost:4000` by default (`PORT` in `.env`).

## Environment variables

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Default database name |
| `PORT` | Port the API listens on |
| `CLIENT_URL` | Frontend origin, used for CORS |
| `DATA_DIR` | Optional. Where `scripts/import_nags.js` reads `*.txt` from. Defaults to `./DATA` |

## API routes

| Base path | Router | Purpose |
|---|---|---|
| `/api/customers` | `routes/customers.js` | Customer CRUD |
| `/api/business-types` | `routes/businessTypes.js` | Business type CRUD |
| `/api/discounts` | `routes/discounts.js` | Discount schedules (`gl2015m1` DB) |
| `/api/*` | `routes/nagsGlass.js` | NAGS makes/models/glass/hardware lookup (`vehicle_db`) |
| `/api/*` | `routes/glassParts.js` | Legacy glass parts fallback |
| `/api/health` | — | Health check |

## Databases

The API connects to three MySQL databases on the same instance via separate pools in `config/`:

- `db.js` → default DB (`DB_NAME`, e.g. `glasslogic`) — customers, business types
- `gl2015Db.js` → `gl2015m1` — discounts
- `nagsDb.js` → `vehicle_db` — NAGS vehicle/glass/hardware data

## Related repo

- Frontend: `glasslogic-frontend`
