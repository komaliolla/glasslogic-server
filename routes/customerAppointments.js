const express = require('express');
const router  = express.Router();
const db      = require('../database/config/db');
const authenticateCustomer = require('../middleware/authenticateCustomer');

router.use(authenticateCustomer);

// GET /api/customer/appointments — confirmed bookings + pending/contacted requests, this customer only.
router.get('/', async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const [confirmed] = await db.query(
      `SELECT id, booking_date, slot_time, vehicle_year, vehicle_make, vehicle_model, vehicle_body_style, notes
       FROM schedule_bookings WHERE customer_id = ? ORDER BY booking_date, slot_time`,
      [customerId]
    );
    const [requested] = await db.query(
      `SELECT id, status, vehicle_year, vehicle_make, vehicle_model, vehicle_body_style, note, created_at
       FROM call_list WHERE customer_id = ? ORDER BY created_at DESC`,
      [customerId]
    );
    res.json({
      confirmed: confirmed.map(r => ({ ...r, kind: 'confirmed' })),
      requested: requested.map(r => ({ ...r, kind: 'requested' })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/appointments — request a new appointment (lands in call_list for staff to triage)
router.post('/', async (req, res) => {
  try {
    const {
      vehicleYear = '', vehicleMake = '', vehicleModel = '', vehicleBodyStyle = '', note = '',
    } = req.body;

    const [[customer]] = await db.query('SELECT name, phone FROM customers WHERE id = ?', [req.customer.customerId]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [result] = await db.query(
      `INSERT INTO call_list (customer_name, phone, vehicle_year, vehicle_make, vehicle_model, vehicle_body_style, note, customer_id, shop_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [customer.name, customer.phone, vehicleYear, vehicleMake, vehicleModel, vehicleBodyStyle, note, req.customer.customerId, req.customer.shopId]
    );
    const [rows] = await db.query('SELECT * FROM call_list WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
