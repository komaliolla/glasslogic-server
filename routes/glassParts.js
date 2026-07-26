const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/makes
router.get('/makes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vehicle_makes ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/makes/:makeId/models
router.get('/makes/:makeId/models', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM vehicle_models WHERE make_id = ? ORDER BY name',
      [req.params.makeId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/body-styles
router.get('/body-styles', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM body_styles ORDER BY description');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/glass-parts?year=2022&make=Honda&model=Civic
// In production this would join against a vehicle lookup table.
// For now it returns all parts; the vehicle filter is a placeholder.
router.get('/glass-parts', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM glass_parts ORDER BY type, description');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/color-prices
router.get('/color-prices', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM color_price_tiers ORDER BY color_name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hardware-parts
router.get('/hardware-parts', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hardware_parts ORDER BY type, part_no');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
