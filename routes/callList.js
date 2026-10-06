const express = require('express');
const router  = express.Router();
const db      = require('../../database/config/db');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');

router.use(authenticate);

// GET /api/call-list
router.get('/', authorize('schedule:view'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM call_list ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/call-list
router.post('/', authorize('schedule:edit'), async (req, res) => {
  try {
    const {
      customerName, phone,
      vehicleYear = '', vehicleMake = '', vehicleModel = '', vehicleBodyStyle = '', note = '',
    } = req.body;
    if (!customerName || !phone) return res.status(400).json({ error: 'customerName and phone are required' });

    const [result] = await db.query(
      `INSERT INTO call_list (customer_name, phone, vehicle_year, vehicle_make, vehicle_model, vehicle_body_style, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customerName, phone, vehicleYear, vehicleMake, vehicleModel, vehicleBodyStyle, note]
    );
    const [rows] = await db.query('SELECT * FROM call_list WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/call-list/:id
router.put('/:id', authorize('schedule:edit'), async (req, res) => {
  try {
    const {
      customerName, phone,
      vehicleYear = '', vehicleMake = '', vehicleModel = '', vehicleBodyStyle = '', note = '',
      status = null,
    } = req.body;
    if (!customerName || !phone) return res.status(400).json({ error: 'customerName and phone are required' });

    await db.query(
      `UPDATE call_list
       SET customer_name = ?, phone = ?, vehicle_year = ?, vehicle_make = ?, vehicle_model = ?, vehicle_body_style = ?, note = ?,
           status = COALESCE(?, status)
       WHERE id = ?`,
      [customerName, phone, vehicleYear, vehicleMake, vehicleModel, vehicleBodyStyle, note, status, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM call_list WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/call-list/:id
router.delete('/:id', authorize('schedule:edit'), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM call_list WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
