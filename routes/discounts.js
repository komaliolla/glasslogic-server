const express = require('express');
const router  = express.Router();
const db      = require('../../database/config/gl2015Db');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

// GET /api/discounts
router.get('/', async (req, res) => {
  try {
    const toLabel = v => v === 'F' ? 'Flat' : v === 'H' ? 'Hourly' : (v || 'Flat');

    // JOIN in SQL so MySQL handles the case-insensitive discount_code match.
    // Read discount_amount2 / labor_rate2 (the columns the legacy app writes to).
    const [rows] = await db.query(
      `SELECT
         d.discount_code, d.discount_name, d.kit_charge, d.kit_amount, d.ukit_amount,
         d.udam_amount, d.two_part_amount, d.udam_1_5_amount, d.two_kit_amount,
         d.material_charge, d.material_amount,
         d.labor_charge, d.repair_charge, d.init_repair_amount, d.addtnl_repair_amount,
         d.edi_flag, d.edi_format,
         dd.nags_prefix, dd.part_type, dd.flat_or_hourly,
         dd.discount_amount2 AS discount_amount,
         dd.labor_rate2      AS labor_rate,
         dd.min_hours2       AS min_hours,
         dd.max_hours2       AS max_hours
       FROM \`discount\` d
       LEFT JOIN \`discount_detail\` dd ON dd.discount_code = d.discount_code AND dd.shop_id = d.shop_id
       WHERE d.shop_id = ?
       ORDER BY d.discount_code ASC, dd.part_type DESC`,
      [req.user.shopId]
    );

    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.discount_code)) {
        map.set(row.discount_code, {
          discount_code:        row.discount_code,
          discount_name:        row.discount_name,
          kit_charge:           row.kit_charge,
          kit_amount:           row.kit_amount,
          ukit_amount:          row.ukit_amount,
          udam_amount:          row.udam_amount,
          two_part_amount:      row.two_part_amount,
          udam_1_5_amount:      row.udam_1_5_amount,
          two_kit_amount:       row.two_kit_amount,
          material_charge:      row.material_charge,
          material_amount:      row.material_amount,
          labor_charge:         row.labor_charge,
          repair_charge:        row.repair_charge,
          init_repair_amount:   row.init_repair_amount,
          addtnl_repair_amount: row.addtnl_repair_amount,
          edi_flag:             row.edi_flag,
          edi_format:           row.edi_format,
          details: [],
        });
      }
      if (row.nags_prefix !== null && row.nags_prefix !== undefined) {
        map.get(row.discount_code).details.push({
          discount_code:   row.discount_code,
          nags_prefix:     row.nags_prefix,
          part_type:       row.part_type,
          flat_or_hourly:  toLabel(row.flat_or_hourly),
          discount_amount: row.discount_amount,
          labor_rate:      row.labor_rate,
          min_hours:       row.min_hours,
          max_hours:       row.max_hours,
          discount_amount2: row.discount_amount,
          labor_rate2:      row.labor_rate,
          min_hours2:       row.min_hours,
          max_hours2:       row.max_hours,
        });
      }
    }

    res.json([...map.values()]);
  } catch (err) {
    console.error('[discounts GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/discounts
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      discount_code, discount_name,
      kit_charge       = 'N', kit_amount       = 0, ukit_amount      = 0,
      udam_amount      = 0,   two_part_amount  = 0, udam_1_5_amount  = 0,
      two_kit_amount   = 0,
      material_charge  = 'N', material_amount  = 0,
      labor_charge     = 'N', repair_charge    = 'N',
      init_repair_amount = 0, addtnl_repair_amount = 0,
      edi_flag         = 'N', edi_format       = '',
      details = [],
    } = req.body;

    if (!discount_code || !discount_name) {
      await conn.rollback();
      return res.status(400).json({ error: 'discount_code and discount_name are required' });
    }

    await conn.query(
      `INSERT INTO discount
        (shop_id, discount_code, discount_name,
         kit_charge, kit_amount, ukit_amount, udam_amount, two_part_amount, udam_1_5_amount, two_kit_amount,
         material_charge, material_amount,
         labor_charge, repair_charge, init_repair_amount, addtnl_repair_amount,
         edi_flag, edi_format)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         discount_name        = VALUES(discount_name),
         kit_charge           = VALUES(kit_charge),
         kit_amount           = VALUES(kit_amount),
         ukit_amount          = VALUES(ukit_amount),
         udam_amount          = VALUES(udam_amount),
         two_part_amount      = VALUES(two_part_amount),
         udam_1_5_amount      = VALUES(udam_1_5_amount),
         two_kit_amount       = VALUES(two_kit_amount),
         material_charge      = VALUES(material_charge),
         material_amount      = VALUES(material_amount),
         labor_charge         = VALUES(labor_charge),
         repair_charge        = VALUES(repair_charge),
         init_repair_amount   = VALUES(init_repair_amount),
         addtnl_repair_amount = VALUES(addtnl_repair_amount),
         edi_flag             = VALUES(edi_flag),
         edi_format           = VALUES(edi_format)`,
      [req.user.shopId, discount_code.toUpperCase(), discount_name,
       kit_charge, kit_amount, ukit_amount, udam_amount, two_part_amount, udam_1_5_amount, two_kit_amount,
       material_charge, material_amount,
       labor_charge, repair_charge, init_repair_amount, addtnl_repair_amount,
       edi_flag, edi_format]
    );

    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      // nags_prefix is CHAR(2) in gl2015m1 — fall back to part_type + index to
      // stay unique, but truncate so a bad/missing prefix never overflows the
      // column and fails the whole transaction under STRICT_TRANS_TABLES.
      const nagsPrefix   = ((d.nags_prefix || '').trim() || `${d.part_type || 'ROW'}${i}`).slice(0, 2);
      const discountAmt  = d.discount_amount  || 0;
      const laborRt      = d.labor_rate       || 0;
      const minHrs       = d.min_hours        || 0;
      const maxHrs       = d.max_hours        || 0;
      await conn.query(
        `INSERT INTO discount_detail
          (shop_id, discount_code, nags_prefix, part_type, flat_or_hourly,
           discount_amount,  labor_rate,  min_hours,  max_hours,
           discount_amount2, labor_rate2, min_hours2, max_hours2)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           part_type        = VALUES(part_type),
           flat_or_hourly   = VALUES(flat_or_hourly),
           discount_amount  = VALUES(discount_amount),
           labor_rate       = VALUES(labor_rate),
           min_hours        = VALUES(min_hours),
           max_hours        = VALUES(max_hours),
           discount_amount2 = VALUES(discount_amount2),
           labor_rate2      = VALUES(labor_rate2),
           min_hours2       = VALUES(min_hours2),
           max_hours2       = VALUES(max_hours2)`,
        [req.user.shopId, discount_code.toUpperCase(), nagsPrefix, d.part_type,
         d.flat_or_hourly === 'Hourly' ? 'H' : 'F',
         discountAmt, laborRt, minHrs, maxHrs,
         discountAmt, laborRt, minHrs, maxHrs]
      );
    }

    await conn.commit();
    res.status(201).json({ discount_code: discount_code.toUpperCase() });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /api/discounts/parts  — NAGS prefix → part type lookup (gl2015m1.parts — shared reference table, not shop-owned)
router.get('/parts', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT nags_prefix, part_type FROM parts ORDER BY part_type, nags_prefix'
    );
    res.json(rows);
  } catch (err) {
    console.error('[discounts/parts GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/discounts/:code/details  — exact legacy query for detail rows
router.get('/:code/details', async (req, res) => {
  try {
    const toLabel = v => v === 'F' ? 'Flat' : v === 'H' ? 'Hourly' : (v || 'Flat');
    const [rows] = await db.query(
      `SELECT
         \`discount_detail\`.\`discount_code\`,
         \`discount_detail\`.\`nags_prefix\`,
         \`discount_detail\`.\`part_type\`,
         \`discount_detail\`.\`flat_or_hourly\`,
         \`discount_detail\`.\`discount_amount2\`  AS discount_amount,
         \`discount_detail\`.\`labor_rate2\`        AS labor_rate,
         \`discount_detail\`.\`min_hours2\`         AS min_hours,
         \`discount_detail\`.\`max_hours2\`         AS max_hours
       FROM \`discount_detail\`
       WHERE \`discount_detail\`.\`discount_code\` = ? AND \`discount_detail\`.\`shop_id\` = ?
       ORDER BY \`discount_detail\`.\`part_type\` DESC`,
      [req.params.code, req.user.shopId]
    );
    res.json(rows.map(r => ({ ...r, flat_or_hourly: toLabel(r.flat_or_hourly) })));
  } catch (err) {
    console.error('[discounts/:code/details GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/discounts/:code  — update header + replace detail rows
router.put('/:code', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const code = req.params.code.toUpperCase();
    const {
      discount_name,
      kit_charge = 'N', kit_amount = 0, ukit_amount = 0,
      udam_amount = 0, two_part_amount = 0, udam_1_5_amount = 0, two_kit_amount = 0,
      material_charge = 'N', material_amount = 0,
      labor_charge = 'N', repair_charge = 'N',
      init_repair_amount = 0, addtnl_repair_amount = 0,
      edi_flag = 'N', edi_format = '',
      details = [],
    } = req.body;

    await conn.query(
      `UPDATE \`discount\` SET
         discount_name = ?, kit_charge = ?, kit_amount = ?, ukit_amount = ?,
         udam_amount = ?, two_part_amount = ?, udam_1_5_amount = ?, two_kit_amount = ?,
         material_charge = ?, material_amount = ?,
         labor_charge = ?, repair_charge = ?, init_repair_amount = ?, addtnl_repair_amount = ?,
         edi_flag = ?, edi_format = ?
       WHERE discount_code = ? AND shop_id = ?`,
      [discount_name,
       kit_charge, kit_amount, ukit_amount,
       udam_amount, two_part_amount, udam_1_5_amount, two_kit_amount,
       material_charge, material_amount,
       labor_charge, repair_charge, init_repair_amount, addtnl_repair_amount,
       edi_flag, edi_format, code, req.user.shopId]
    );

    await conn.query('DELETE FROM `discount_detail` WHERE discount_code = ? AND shop_id = ?', [code, req.user.shopId]);

    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      const nagsPrefix  = ((d.nags_prefix || '').trim() || `${d.part_type || 'ROW'}${i}`).slice(0, 2);
      const discountAmt = d.discount_amount || 0;
      const laborRt     = d.labor_rate      || 0;
      const minHrs      = d.min_hours       || 0;
      const maxHrs      = d.max_hours       || 0;
      await conn.query(
        `INSERT INTO \`discount_detail\`
           (shop_id, discount_code, nags_prefix, part_type, flat_or_hourly,
            discount_amount, labor_rate, min_hours, max_hours,
            discount_amount2, labor_rate2, min_hours2, max_hours2)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           part_type        = VALUES(part_type),
           flat_or_hourly   = VALUES(flat_or_hourly),
           discount_amount  = VALUES(discount_amount),
           labor_rate       = VALUES(labor_rate),
           min_hours        = VALUES(min_hours),
           max_hours        = VALUES(max_hours),
           discount_amount2 = VALUES(discount_amount2),
           labor_rate2      = VALUES(labor_rate2),
           min_hours2       = VALUES(min_hours2),
           max_hours2       = VALUES(max_hours2)`,
        [req.user.shopId, code, nagsPrefix, d.part_type,
         d.flat_or_hourly === 'Hourly' ? 'H' : 'F',
         discountAmt, laborRt, minHrs, maxHrs,
         discountAmt, laborRt, minHrs, maxHrs]
      );
    }

    await conn.commit();
    res.json({ discount_code: code });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /api/discounts/:code
router.delete('/:code', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM discount_detail WHERE discount_code = ? AND shop_id = ?', [req.params.code, req.user.shopId]);
    const [result] = await conn.query('DELETE FROM discount WHERE discount_code = ? AND shop_id = ?', [req.params.code, req.user.shopId]);
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Not found' });
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
