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

2. Create the database(s) and import reference data — schema, raw data, and import scripts live in the sibling [../database](../database) folder. See [../database/README.md](../database/README.md) for full steps. In short:

   ```bash
   cd ../database && npm install
   mysql -u root -p < schema/nags_schema.sql
   npm run import-nags   # imports the NAGS data/*.txt files (~2M rows, 5-15 min)
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

`DATA_DIR` (optional, where NAGS import reads `*.txt` from) now belongs to `../database/.env` — see [../database/README.md](../database/README.md).

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

The API connects to four MySQL databases on the same instance via separate pools in the sibling [../database/config/](../database/config/) folder:

- `db.js` → default DB (`DB_NAME`, e.g. `glasslogic`) — customers, business types, schedule_bookings, call_list
- `gl2015Db.js` → `gl2015m1` — discounts
- `nagsDb.js` → `vehicle_db` — NAGS vehicle/glass/hardware data
- `userDb.js` → `user` — employees, shop_settings, user_credentials, RBAC tables

See [../database/README.md](../database/README.md) for schema/setup details.

## Related repo

- Frontend: `glasslogic-frontend`
