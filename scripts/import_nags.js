/**
 * import_nags.js
 * Streams every DATA/*.txt file into MySQL.
 * Usage: node scripts/import_nags.js
 * Requires .env with DB_* vars (or defaults to root@localhost/glasslogic).
 * DATA_DIR defaults to ../DATA (server/DATA) — set the DATA_DIR env var to
 * point elsewhere.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs      = require('fs');
const path    = require('path');
const readline = require('readline');
const mysql   = require('mysql2/promise');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../DATA');
const BATCH    = 500;   // rows per INSERT

const DB_CFG = {
  host:               process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT      || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'glasslogic',
  waitForConnections: true,
  connectionLimit:    5,
  multipleStatements: true,
};

// ── helpers ──────────────────────────────────────────────────

function col(parts, i, def = '') {
  const v = (parts[i] ?? '').trim();
  return v === '' ? def : v;
}

function num(parts, i, def = 0) {
  const v = parseFloat((parts[i] ?? '').trim());
  return isNaN(v) ? def : v;
}

function int_(parts, i, def = 0) {
  const v = parseInt((parts[i] ?? '').trim(), 10);
  return isNaN(v) ? def : v;
}

function date_(parts, i) {
  const s = (parts[i] ?? '').trim();
  if (!s || s.length < 8) return null;
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

async function bulkInsert(conn, table, cols, rows) {
  if (!rows.length) return;
  const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
  const sql = `INSERT IGNORE INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`;
  await conn.execute(sql, rows.flat());
}

async function streamFile(filePath, onRows) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'latin1' }),
      crlfDelay: Infinity,
    });
    const batch = [];
    rl.on('line', line => {
      if (!line.trim()) return;
      const parts = line.split('\t');
      const row = onRows(parts);
      if (row) batch.push(row);
    });
    rl.on('close', () => resolve(batch));
    rl.on('error', reject);
  });
}

async function importFile(conn, filePath, table, cols, mapper) {
  process.stdout.write(`  ${table.padEnd(28)} `);

  const allRows = await new Promise((resolve, reject) => {
    const rows = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'latin1' }),
      crlfDelay: Infinity,
    });
    rl.on('line', line => {
      if (!line.trim()) return;
      const parts = line.split('\t');
      const row = mapper(parts);
      if (row) rows.push(row);
    });
    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });

  for (let i = 0; i < allRows.length; i += BATCH) {
    await bulkInsert(conn, table, cols, allRows.slice(i, i + BATCH));
  }

  console.log(`${String(allRows.length).padStart(8)} rows`);
}

// ── main ─────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to MySQL…');
  const conn = await mysql.createConnection(DB_CFG);
  console.log(`Connected to ${DB_CFG.database}@${DB_CFG.host}\n`);
  await conn.execute('SET foreign_key_checks = 0');
  await conn.execute('SET unique_checks = 0');

  const d = DATA_DIR;

  // ── Reference tables ─────────────────────────────────────

  await importFile(conn, `${d}/make.txt`, 'makes',
    ['id','nags_code','abbreviation','full_name'],
    p => [int_(p,0), col(p,1), col(p,2), col(p,3)]);

  await importFile(conn, `${d}/make_model.txt`, 'models',
    ['id','make_id','code','name'],
    p => [int_(p,0), int_(p,1), col(p,2), col(p,3)]);

  await importFile(conn, `${d}/body_style.txt`, 'body_styles',
    ['id','code','description'],
    p => [int_(p,0), col(p,1), col(p,2)]);

  await importFile(conn, `${d}/glass_color.txt`, 'glass_colors',
    ['code','tier','description'],
    p => [col(p,0), int_(p,1,1), col(p,2)]);

  await importFile(conn, `${d}/hw_color.txt`, 'hw_colors',
    ['code','description'],
    p => [col(p,0), col(p,1)]);

  await importFile(conn, `${d}/hw_type.txt`, 'hw_types',
    ['code','description','unit'],
    p => [col(p,0), col(p,1), col(p,2)]);

  await importFile(conn, `${d}/opening_type.txt`, 'opening_types',
    ['code','description'],
    p => [col(p,0), col(p,1)]);

  await importFile(conn, `${d}/qual.txt`, 'qualifiers',
    ['id','type_id','description'],
    p => [int_(p,0), int_(p,1), col(p,2)]);

  await importFile(conn, `${d}/note.txt`, 'notes',
    ['id','type','text'],
    p => [int_(p,0), col(p,1), col(p,2)]);

  await importFile(conn, `${d}/mf.txt`, 'manufacturers',
    ['code','abbreviation','full_name','active_oem','active_retail'],
    p => [col(p,0), col(p,1), col(p,2), col(p,3,'N'), col(p,4,'N')]);

  // interchange.txt here = glass manufacturer codes (AGC→ASAHI etc.)
  await importFile(conn, `${d}/interchange.txt`, 'glass_manufacturers',
    ['code','full_name'],
    p => [col(p,0), col(p,1)]);

  await importFile(conn, `${d}/veh_modifier.txt`, 'vehicle_modifiers',
    ['id','code','name'],
    p => [int_(p,0), col(p,1), col(p,2)]);

  // ── Vehicle catalog ───────────────────────────────────────

  await importFile(conn, `${d}/veh.txt`, 'vehicles',
    ['id','year','make_id','model_id','body_style_code','designator','col7','col8'],
    p => [int_(p,0), int_(p,1), int_(p,2), int_(p,3), col(p,4), col(p,5), col(p,6), col(p,7)]);

  // ── NAGS Glass catalog ────────────────────────────────────

  await importFile(conn, `${d}/nags_glass.txt`, 'nags_glass',
    ['part_no','prefix','nags_num','is_oem','height','width',
     'is_encapsulated','is_modular','has_solar','solar_tint',
     'is_privacy','is_heated','col13','col14','col15','col16','labor_hours'],
    p => [col(p,0), col(p,1), col(p,2), col(p,3,'N'),
          num(p,4), num(p,5),
          col(p,6,'N'), col(p,7,'N'), col(p,8,'N'), col(p,9),
          col(p,10,'N'), col(p,11,'N'),
          col(p,12), col(p,13), col(p,14), col(p,15),
          num(p,16)]);

  await importFile(conn, `${d}/nags_glass_det.txt`, 'nags_glass_det',
    ['part_no','flag1','color_code','flag2'],
    p => [col(p,0), col(p,1), col(p,2), col(p,3)]);

  await importFile(conn, `${d}/nags_glass_prc.txt`, 'nags_glass_prc',
    ['part_no','is_oem','region','flag1','unit','effective_date','discount_type','list_price','price_type','col10'],
    p => {
      const d8 = date_(p,5);
      if (!d8) return null;
      return [col(p,0), col(p,1,'N'), col(p,2), col(p,3), col(p,4),
              d8, col(p,6), num(p,7), col(p,8), col(p,9)];
    });

  await importFile(conn, `${d}/nags_glass_qual.txt`, 'nags_glass_qual',
    ['part_no','qual_id','position'],
    p => [col(p,0), int_(p,1), int_(p,2)]);

  await importFile(conn, `${d}/nags_glass_intchg.txt`, 'nags_glass_intchg',
    ['part_no','interchg_part','mfr_code','flag'],
    p => [col(p,0), col(p,1), col(p,2), col(p,3)]);

  await importFile(conn, `${d}/glass_on_opening.txt`, 'glass_on_opening',
    ['part_no','opening_num','color_code','col4','col5','col6'],
    p => [col(p,0), int_(p,1), col(p,2), col(p,3), col(p,4), col(p,5)]);

  // ── Vehicle → Glass mapping (large) ──────────────────────

  await importFile(conn, `${d}/veh_glass.txt`, 'veh_glass',
    ['veh_id','part_no','flag1','col4','col5','col6','col7'],
    p => [int_(p,0), col(p,1), int_(p,2), col(p,3), col(p,4), col(p,5), col(p,6)]);

  await importFile(conn, `${d}/veh_glass_region.txt`, 'veh_glass_region',
    ['veh_id','part_no','flag1','unit','list_price'],
    p => [int_(p,0), col(p,1), int_(p,2), col(p,3), num(p,4)]);

  await importFile(conn, `${d}/veh_glass_note.txt`, 'veh_glass_note',
    ['veh_id','part_no','flag1','note_id'],
    p => [int_(p,0), col(p,1), int_(p,2), int_(p,3)]);

  // ── OEM Glass ─────────────────────────────────────────────

  await importFile(conn, `${d}/oem_glass.txt`, 'oem_glass',
    ['mf_code','mf_part_no','color_code','is_oem','part_no2'],
    p => [col(p,0), col(p,1).trim(), col(p,2), col(p,3,'N'), col(p,4).trim()]);

  // ── NAGS Hardware catalog ─────────────────────────────────

  await importFile(conn, `${d}/nags_hw.txt`, 'nags_hw',
    ['part_no','type_code','hw_num','col4','col5'],
    p => [col(p,0), col(p,1), col(p,2), col(p,3), col(p,4)]);

  await importFile(conn, `${d}/nags_hw_det.txt`, 'nags_hw_det',
    ['part_no','color_code'],
    p => [col(p,0), col(p,1)]);

  await importFile(conn, `${d}/nags_hw_prc.txt`, 'nags_hw_prc',
    ['part_no','region','unit','list_price','effective_date','active'],
    p => {
      const d8 = date_(p,4);
      if (!d8) return null;
      return [col(p,0), col(p,1), col(p,2), num(p,3), d8, col(p,5,'A')];
    });

  await importFile(conn, `${d}/nags_hw_plmt.txt`, 'nags_hw_plmt',
    ['part_no','opening_num','col3','col4','side'],
    p => [col(p,0), int_(p,1), col(p,2), col(p,3), col(p,4)]);

  await importFile(conn, `${d}/nags_hw_cfg_det.txt`, 'nags_hw_cfg_det',
    ['veh_id','part_no','flag1','quantity','flag2','col6','col7','col8'],
    p => [int_(p,0), col(p,1), int_(p,2), num(p,3,1), int_(p,4),
          col(p,5), col(p,6), col(p,7)]);

  await importFile(conn, `${d}/nags_hw_cfg_det_qual.txt`, 'nags_hw_cfg_det_qual',
    ['veh_id','part_no','flag1','flag2','qual_id'],
    p => [int_(p,0), col(p,1), int_(p,2), int_(p,3), int_(p,4)]);

  // ── Manufacturer hardware (OEM) ───────────────────────────

  await importFile(conn, `${d}/mf_hw.txt`, 'mf_hw',
    ['mf_code','mf_part_no','flag'],
    p => [col(p,0), col(p,1).trim(), col(p,2)]);

  await importFile(conn, `${d}/mf_hw_prc.txt`, 'mf_hw_prc',
    ['mf_code','mf_part_no','unit','effective_date','list_price','active'],
    p => {
      const d8 = date_(p,3);
      if (!d8) return null;
      return [col(p,0), col(p,1).trim(), col(p,2), d8, num(p,4), col(p,5,'A')];
    });

  await importFile(conn, `${d}/mf_hw_region.txt`, 'mf_hw_region',
    ['mf_code','mf_part_no','unit','effective_date','list_price','active','col7','col8'],
    p => {
      const d8 = date_(p,3);
      if (!d8) return null;
      return [col(p,0), col(p,1).trim(), col(p,2), d8, num(p,4),
              col(p,5,'A'), col(p,6), col(p,7)];
    });

  await importFile(conn, `${d}/nags_mf_hw_xref.txt`, 'nags_mf_hw_xref',
    ['mf_code','mf_part_no','nags_part_no'],
    p => [col(p,0), col(p,1).trim(), col(p,2)]);

  await conn.execute('SET foreign_key_checks = 1');
  await conn.execute('SET unique_checks = 1');
  await conn.end();
  console.log('\nImport complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
