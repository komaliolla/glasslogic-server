# GlassLogic — Database Setup

## 1. Create the database & tables

```bash
mysql -u root -p < db/nags_schema.sql
```

## 2. Create a MySQL user (optional but recommended)

```sql
CREATE USER 'glasslogic_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON glasslogic.* TO 'glasslogic_user'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Configure .env

Copy `.env.example` to `.env` and fill in:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=glasslogic_user
DB_PASSWORD=your_password
DB_NAME=glasslogic
PORT=4000
CLIENT_URL=http://localhost:5173
```

## 4. Import the NAGS DATA files (~2M rows, takes 5–15 min)

The raw `DATA/*.txt` files live in `server/DATA` (gitignored — not committed). If you keep them elsewhere, set `DATA_DIR` in `.env` to point at that folder.

```bash
node scripts/import_nags.js
```

Progress is printed per table.

## 5. Start the API server

```bash
npm install && npm start
```

## 6. Start the frontend

In the sibling `frontend` repo:

```bash
npm install && npm run dev
```

---

## Table summary

| Table | Source file | Rows (approx) |
|---|---|---|
| makes | make.txt | ~900 |
| models | make_model.txt | ~9 000 |
| body_styles | body_style.txt | ~100 |
| vehicles | veh.txt | ~42 000 |
| nags_glass | nags_glass.txt | ~34 000 |
| nags_glass_prc | nags_glass_prc.txt | ~90 000 |
| veh_glass | veh_glass.txt | ~428 000 |
| veh_glass_region | veh_glass_region.txt | ~428 000 |
| nags_hw | nags_hw.txt | ~60 000 |
| nags_hw_cfg_det | nags_hw_cfg_det.txt | ~213 000 |
| … | … | … |
