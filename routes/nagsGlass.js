const express = require('express');
const router  = express.Router();
const db      = require('../config/nagsDb'); // vehicle_db

// Windshield prefix codes (all others are tempered/door/specialty)
const WINDSHIELD_PREFIXES = new Set(['FW','FQ','FV','FD','FB','FL','FP','FR','FS','FT','FY']);

function glassType(prefix) {
  return WINDSHIELD_PREFIXES.has((prefix || '').toUpperCase()) ? 'Windshield' : 'Tempered';
}

function buildDescription(type, features) {
  return features ? `${type} — ${features}` : type;
}

// ── GET /api/years ────────────────────────────────────────────
router.get('/years', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT model_yr AS year FROM veh ORDER BY model_yr DESC`
    );
    res.json(rows.map(r => String(r.year)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/makes?year= ──────────────────────────────────────
// Returns makes that have vehicles in the given year.
router.get('/makes', async (req, res) => {
  const { year } = req.query;
  try {
    let rows;
    if (year) {
      [rows] = await db.query(
        `SELECT DISTINCT m.make_id AS id, m.abbrev AS code, m.name
         FROM make m
         JOIN make_model mm ON mm.make_id        = m.make_id
         JOIN veh v         ON v.make_model_id   = mm.make_model_id
         WHERE v.model_yr = ?
         ORDER BY m.name`,
        [year]
      );
    } else {
      [rows] = await db.query(
        `SELECT make_id AS id, abbrev AS code, name FROM make ORDER BY name`
      );
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/makes/:makeId/models?year= ──────────────────────
// Returns models (make_model rows) that have vehicles for the given year + make.
router.get('/makes/:makeId/models', async (req, res) => {
  const { year } = req.query;
  try {
    let rows;
    if (year) {
      [rows] = await db.query(
        `SELECT DISTINCT mm.make_model_id AS id, mm.make_id, mm.abbrev AS code, mm.name
         FROM make_model mm
         JOIN veh v ON v.make_model_id = mm.make_model_id
         WHERE v.model_yr = ? AND mm.make_id = ?
         ORDER BY mm.name`,
        [year, req.params.makeId]
      );
    } else {
      [rows] = await db.query(
        `SELECT make_model_id AS id, make_id, abbrev AS code, name
         FROM make_model WHERE make_id = ? ORDER BY name`,
        [req.params.makeId]
      );
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/body-styles-by-vehicle?year=&makeId=&modelId= ───
// modelId = make_model_id from the make_model table.
// Returns body styles available for that year + model combination.
router.get('/body-styles-by-vehicle', async (req, res) => {
  const { year, makeId, modelId } = req.query;
  if (!year || !makeId) {
    return res.status(400).json({ error: 'year and makeId are required' });
  }
  try {
    let rows;
    if (modelId) {
      [rows] = await db.query(
        `SELECT DISTINCT bs.id, bs.code, bs.description
         FROM body_styles bs
         JOIN veh v ON v.body_style_id = bs.id
         WHERE v.model_yr = ? AND v.make_model_id = ?
         ORDER BY bs.description`,
        [String(year), String(modelId)]
      );
    } else {
      [rows] = await db.query(
        `SELECT DISTINCT bs.id, bs.code, bs.description
         FROM body_styles bs
         JOIN veh v ON v.body_style_id = bs.id
         JOIN make_model mm ON mm.make_model_id = v.make_model_id
         WHERE v.model_yr = ? AND mm.make_id = ?
         ORDER BY bs.description`,
        [String(year), parseInt(makeId)]
      );
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/body-styles ──────────────────────────────────────
router.get('/body-styles', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, code, description FROM body_styles ORDER BY description`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/glass-pricing/:partNo ───────────────────────────
// Returns the actual color variants and per-color prices for a specific part.
router.get('/glass-pricing/:partNo', async (req, res) => {
  const partNo = req.params.partNo.toUpperCase();
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT
         CASE RIGHT(ngd.glass_color_cd, 1)
           WHEN 'T' THEN SUBSTRING_INDEX(gc1.dsc, '/', 1)
           WHEN 'B' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Blue Shade')
           WHEN 'P' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Privacy')
           WHEN 'G' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Aluminum Frame')
           WHEN 'Y' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Aluminum Frame')
           WHEN 'C' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Aluminum Frame')
           WHEN 'S' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Shaded')
           WHEN 'K' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Privacy')
           WHEN 'Z' THEN CONCAT(SUBSTRING_INDEX(gc1.dsc, '/', 1), '/Blue Shade')
           ELSE gc1.dsc
         END                                           AS color,
         ngp.prc                                       AS price,
         ngc.nags_glass_id,
         ngd.glass_color_cd                            AS color_code,
         CONCAT(ngd.glass_color_cd, ngd.atchmnt_flag)  AS display_code,
         ngd.atchmnt_flag,
         ngd.prem_flag,
         ngc.mlding_flag,
         ngc.atchmnt_is_clip,
         ngc.atchmnt_is_mlding,
         ngc.nags_labor,
         ngc.atchmnt_dsc
       FROM nags_glass_cfg ngc
       JOIN nags_glass_det ngd
         ON ngc.nags_glass_id   = ngd.nags_glass_id
        AND ngc.atchmnt_flag    = ngd.atchmnt_flag
       JOIN nags_glass_prc ngp
         ON ngp.nags_glass_id   = ngd.nags_glass_id
        AND ngp.atchmnt_flag    = ngd.atchmnt_flag
        AND ngp.glass_color_cd  = ngd.glass_color_cd
        AND ngp.prem_flag       = ngd.prem_flag
       JOIN glass_color gc1
         ON LEFT(ngd.glass_color_cd, 1) = gc1.glass_color_cd
       WHERE ngc.nags_glass_id = ?
         AND ngp.eff_dt = (
           SELECT MAX(p2.eff_dt)
           FROM nags_glass_prc AS p2
           WHERE p2.nags_glass_id  = ngp.nags_glass_id
             AND p2.atchmnt_flag   = ngp.atchmnt_flag
             AND p2.glass_color_cd = ngp.glass_color_cd
             AND p2.prem_flag      = ngp.prem_flag
         )
       ORDER BY color`,
      [partNo]
    );
    res.json(rows.map(r => ({
      color:            r.color,
      price:            parseFloat(r.price) || 0,
      color_code:       r.color_code,
      display_code:     r.display_code,
      atchmnt_flag:     r.atchmnt_flag,
      prem_flag:        r.prem_flag,
      labor_hours:      r.nags_labor != null ? parseFloat(r.nags_labor) : 2.0,
      mlding_flag:      r.mlding_flag,
      atchmnt_is_clip:  r.atchmnt_is_clip,
      atchmnt_is_mlding: r.atchmnt_is_mlding,
      atchmnt_dsc:      r.atchmnt_dsc || '',
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/glass-colors ─────────────────────────────────────
router.get('/glass-colors', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT glass_color_cd AS code, glass_color_type_cd AS tier, dsc AS description
       FROM glass_color ORDER BY dsc`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/color-prices ─────────────────────────────────────
router.get('/color-prices', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT glass_color_cd AS color_code,
              dsc            AS color_name,
              glass_color_type_cd AS tier,
              CASE glass_color_type_cd
                WHEN '1' THEN 1.0000
                WHEN '2' THEN 1.0800
                WHEN '3' THEN 1.1200
                WHEN '4' THEN 1.1500
                WHEN '5' THEN 1.2000
                ELSE 1.0000
              END AS price_multiplier,
              2.0 AS labor_hours
       FROM glass_color
       ORDER BY glass_color_type_cd, dsc`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/glass-by-vehicle?year=&makeId=&modelId=&bodyStyleId= ──
// year       = model_yr  in veh
// makeId     = make_id   in make
// modelId    = make_model_id in make_model (and veh.make_model_id)
// bodyStyleId= body_style_id in veh (numeric id from body_styles)
router.get('/glass-by-vehicle', async (req, res) => {
  const { year, makeId, modelId, bodyStyleId } = req.query;
  if (!year || !makeId) {
    return res.status(400).json({ error: 'year and makeId are required' });
  }

  try {
    const params = [String(year)];
    let makeJoin = '';
    let whereExtra = '';

    if (modelId) {
      whereExtra += ' AND v.make_model_id = ?';
      params.push(String(modelId));
    } else {
      makeJoin = 'JOIN make_model mm ON mm.make_model_id = v.make_model_id';
      whereExtra += ' AND mm.make_id = ?';
      params.push(parseInt(makeId));
    }

    if (bodyStyleId) {
      whereExtra += ' AND v.body_style_id = ?';
      params.push(String(bodyStyleId));
    }

    const [rows] = await db.query(
      `SELECT DISTINCT
         ng.nags_glass_id          AS part_no,
         ot.dsc                    AS opening_type,
         ot.sort_order,
         goo.pos_cd,
         goo.side_cd,
         ng.ant_flag,
         ng.encap_flag,
         ng.hds_up_disp_flag,
         ng.heated_flag,
         ng.solar_flag,
         ng.slider_flag,
         ng.num_holes,
         vg.from_range,
         vg.to_range,
         (SELECT GROUP_CONCAT(n.text ORDER BY vgn.note_id SEPARATOR '; ')
          FROM veh_glass_note vgn
          JOIN note n ON n.note_id = vgn.note_id
          WHERE vgn.nags_glass_id = ng.nags_glass_id
            AND vgn.veh_id = vg.veh_id) AS note,
         ng.prefix_cd              AS prefix,
         ng.blk_size1              AS height,
         ng.blk_size2              AS width,
         (SELECT GROUP_CONCAT(q.dsc ORDER BY ngq.qual_seq SEPARATOR '/')
          FROM nags_glass_qual ngq
          JOIN qual q ON q.qual_cd = ngq.qual_cd
          WHERE ngq.nags_glass_id = ng.nags_glass_id) AS features,
         (SELECT ngd.glass_color_cd FROM nags_glass_det ngd
          WHERE ngd.nags_glass_id = ng.nags_glass_id LIMIT 1) AS color_code,
         COALESCE(
           (SELECT p.prc FROM nags_glass_prc p
            WHERE p.nags_glass_id = ng.nags_glass_id AND p.prc > 0
            ORDER BY p.eff_dt DESC LIMIT 1),
           0
         ) AS list_price
       FROM nags_glass ng
       JOIN glass_on_opening goo
         ON goo.nags_glass_id = ng.nags_glass_id
       JOIN veh_glass vg
         ON vg.nags_glass_id = goo.nags_glass_id
       JOIN opening_type ot
         ON ot.opening_type_cd = goo.opening_type_cd
       WHERE vg.veh_id IN (
         SELECT v.veh_id FROM veh v
         ${makeJoin}
         WHERE v.model_yr = ?${whereExtra}
       )
       ORDER BY ot.sort_order ASC, ng.nags_glass_id ASC
       LIMIT 200`,
      params
    );

    res.json(rows.map(r => {
      const type = glassType(r.prefix);
      return {
        part_no:         r.part_no,
        description:     buildDescription(type, r.features),
        type,
        prefix:          r.prefix,
        labor_hours:     2.0,
        list_price:      parseFloat(r.list_price) || 0,
        height:          parseFloat(r.height) || 0,
        width:           parseFloat(r.width) || 0,
        color_code:      r.color_code || '',
        opening_type:    r.opening_type || '',
        sort_order:      r.sort_order || 0,
        pos_cd:          r.pos_cd || '',
        side_cd:         r.side_cd || '',
        num_holes:       r.num_holes || 0,
        from_range:      r.from_range || '',
        to_range:        r.to_range || '',
        note:            r.note || '',
        has_antenna:     r.ant_flag === 'Y',
        is_encapsulated: r.encap_flag === 'Y',
        is_hud:          r.hds_up_disp_flag === 'Y',
        is_heated:       r.heated_flag === 'Y',
        has_solar:       r.solar_flag === 'Y',
        is_modular:      r.slider_flag === 'Y',
      };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/glass-parts?q= ───────────────────────────────────
// Part number / prefix search (for NAGSByPartNumber).
router.get('/glass-parts', async (req, res) => {
  const { q, limit = 200 } = req.query;
  try {
    const params = [];
    let where = '1=1';
    if (q) {
      where = 'ng.nags_glass_id LIKE ? OR ng.prefix_cd LIKE ?';
      const like = `%${q.toUpperCase()}%`;
      params.push(like, like);
    }

    const [rows] = await db.query(
      `SELECT
         ng.nags_glass_id AS part_no,
         ng.prefix_cd     AS prefix,
         ng.solar_flag    AS has_solar,
         ng.heated_flag   AS is_heated,
         ng.slider_flag   AS is_modular,
         (SELECT GROUP_CONCAT(q.dsc ORDER BY ngq.qual_seq SEPARATOR '/')
          FROM nags_glass_qual ngq
          JOIN qual q ON q.qual_cd = ngq.qual_cd
          WHERE ngq.nags_glass_id = ng.nags_glass_id) AS features,
         COALESCE(
           (SELECT p.prc FROM nags_glass_prc p
            WHERE p.nags_glass_id = ng.nags_glass_id AND p.prc > 0
            ORDER BY p.eff_dt DESC LIMIT 1),
           0
         ) AS list_price
       FROM nags_glass ng
       WHERE ${where}
       ORDER BY ng.nags_glass_id
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    res.json(rows.map(r => {
      const type = glassType(r.prefix);
      return {
        part_no:     r.part_no,
        description: buildDescription(type, r.features),
        type,
        prefix:      r.prefix,
        labor_hours: 2.0,
        list_price:  parseFloat(r.list_price) || 0,
      };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/glass-part/:partNo ───────────────────────────────
router.get('/glass-part/:partNo', async (req, res) => {
  const { partNo } = req.params;
  try {
    const [[part]] = await db.query(
      `SELECT ng.*,
              COALESCE(
                (SELECT p.prc FROM nags_glass_prc p
                 WHERE p.nags_glass_id = ng.nags_glass_id AND p.prc > 0
                 ORDER BY p.eff_dt DESC LIMIT 1),
                0
              ) AS list_price,
              (SELECT GROUP_CONCAT(q.dsc ORDER BY ngq.qual_seq SEPARATOR '/')
               FROM nags_glass_qual ngq
               JOIN qual q ON q.qual_cd = ngq.qual_cd
               WHERE ngq.nags_glass_id = ng.nags_glass_id) AS features,
              ngd.glass_color_cd AS color_code
       FROM nags_glass ng
       LEFT JOIN nags_glass_det ngd ON ngd.nags_glass_id = ng.nags_glass_id
       WHERE ng.nags_glass_id = ?`,
      [partNo.toUpperCase()]
    );

    if (!part) return res.status(404).json({ error: 'Part not found' });

    const type = glassType(part.prefix_cd);
    res.json({
      part_no:         part.nags_glass_id,
      description:     buildDescription(type, part.features),
      type,
      prefix:          part.prefix_cd,
      labor_hours:     2.0,
      list_price:      parseFloat(part.list_price) || 0,
      height:          parseFloat(part.blk_size1) || 0,
      width:           parseFloat(part.blk_size2) || 0,
      is_oem:          false,
      is_encapsulated: part.encap_flag === 'Y',
      is_modular:      part.slider_flag === 'Y',
      has_solar:       part.solar_flag === 'Y',
      is_heated:       part.heated_flag === 'Y',
      is_privacy:      false,
      color_code:      part.color_code || '',
      color_desc:      '',
      interchange:     [],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/fitment/:partNo ──────────────────────────────────
router.get('/fitment/:partNo', async (req, res) => {
  const { partNo } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT v.model_yr AS year, m.name AS make, mm.name AS model,
              bs.description AS style
       FROM veh_glass vg
       JOIN veh v          ON v.veh_id          = vg.veh_id
       JOIN make_model mm  ON mm.make_model_id  = v.make_model_id
       JOIN make m         ON m.make_id         = mm.make_id
       LEFT JOIN body_styles bs ON bs.id = v.body_style_id
       WHERE vg.nags_glass_id = ?
       ORDER BY v.model_yr DESC, m.name, mm.name
       LIMIT 500`,
      [partNo.toUpperCase()]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/hardware-for-glass?year=&makeId=&modelId=&bodyStyleId=&nagsGlassId= ──
router.get('/hardware-for-glass', async (req, res) => {
  const { year, makeId, modelId, bodyStyleId, nagsGlassId } = req.query;
  if (!year || !makeId || !nagsGlassId) {
    return res.status(400).json({ error: 'year, makeId, and nagsGlassId are required' });
  }
  try {
    const vehParams = [String(year)];
    let makeJoin = '';
    let vehWhere = '';
    if (modelId) {
      vehWhere += ' AND v.make_model_id = ?';
      vehParams.push(String(modelId));
    } else {
      makeJoin = 'JOIN make_model mm ON mm.make_model_id = v.make_model_id';
      vehWhere += ' AND mm.make_id = ?';
      vehParams.push(parseInt(makeId));
    }
    if (bodyStyleId) {
      vehWhere += ' AND v.body_style_id = ?';
      vehParams.push(String(bodyStyleId));
    }

    const [rows] = await db.query(
      `SELECT DISTINCT
         nmx.mf_hw_id                AS part_no,
         COALESCE(hc.dsc, '')        AS color,
         COALESCE(ht.dsc, '')        AS type,
         nmx.mf_id,
         vgr.region_cd,
         nhcd.nags_hw_id,
         COALESCE(
           (SELECT p.prc FROM nags_hw_prc p
            WHERE p.nags_hw_id = nh.nags_hw_id AND p.prc > 0
            ORDER BY p.eff_dt DESC LIMIT 1),
           0
         ) AS list_price
       FROM veh_glass_region vgr
       JOIN nags_hw_cfg_det nhcd
         ON  nhcd.nags_hw_cfg_id = vgr.note_id
       JOIN nags_mf_hw_xref nmx
         ON  nmx.nags_hw_id = nhcd.nags_hw_id
       JOIN mf_hw mh
         ON  mh.mf_id    = nmx.mf_id
         AND mh.mf_hw_id = nmx.mf_hw_id
       JOIN nags_hw nh
         ON  nh.nags_hw_id = nmx.nags_hw_id
       LEFT JOIN hw_type ht
         ON  ht.hw_type_cd = nh.hw_type_cd
       LEFT JOIN hw_color hc
         ON  hc.hw_color_cd = mh.hw_color_cd
       WHERE vgr.nags_glass_id = ?
         AND vgr.veh_id IN (
           SELECT v.veh_id FROM veh v
           ${makeJoin}
           WHERE v.model_yr = ?${vehWhere}
         )
       ORDER BY nmx.mf_hw_id DESC`,
      [nagsGlassId.toUpperCase(), ...vehParams]
    );

    res.json(rows.map(r => ({
      part_no:    r.part_no,
      color:      r.color,
      type:       r.type,
      list_price: parseFloat(r.list_price) || 0,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/hardware-by-vehicle ─────────────────────────────
router.get('/hardware-by-vehicle', async (req, res) => {
  res.json([]);
});

// ── GET /api/hardware-parts ───────────────────────────────────
router.get('/hardware-parts', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT nh.nags_hw_id AS part_no,
              ht.dsc        AS type,
              nhd.hw_color_cd AS color_code,
              COALESCE(
                (SELECT p.prc FROM nags_hw_prc p
                 WHERE p.nags_hw_id = nh.nags_hw_id AND p.prc > 0
                 ORDER BY p.eff_dt DESC LIMIT 1),
                0
              ) AS list_price
       FROM nags_hw nh
       JOIN hw_type ht ON ht.hw_type_cd = nh.hw_type_cd
       LEFT JOIN nags_hw_det nhd ON nhd.nags_hw_id = nh.nags_hw_id
       ORDER BY ht.dsc, nh.nags_hw_id
       LIMIT 500`
    );
    res.json(rows.map(r => ({
      part_no:     r.part_no,
      type:        r.type || '',
      color:       '',
      color_code:  r.color_code || '',
      description: r.type || '',
      list_price:  parseFloat(r.list_price) || 0,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
