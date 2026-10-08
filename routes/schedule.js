const express = require('express');
const router  = express.Router();
const db      = require('../database/config/db');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');

router.use(authenticate);

// GET /api/schedule?date=YYYY-MM-DD
router.get('/', authorize('schedule:view'), async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });
  try {
    const [rows] = await db.query(
      `SELECT slot_time, slot_index, customer_name, phone, vin, notes,
              vehicle_year, vehicle_make, vehicle_model, vehicle_body_style
       FROM schedule_bookings WHERE booking_date = ? AND shop_id = ?`,
      [date, req.user.shopId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule — book or update a single slot
router.put('/', authorize('schedule:edit'), async (req, res) => {
  try {
    const {
      date, slot, slotIndex, customerName, phone = '', vin = '', notes = '',
      vehicleYear = '', vehicleMake = '', vehicleModel = '', vehicleBodyStyle = '',
      customerId = null,
    } = req.body;
    if (!date || !slot || slotIndex === undefined || slotIndex === null || !customerName) {
      return res.status(400).json({ error: 'date, slot, slotIndex, and customerName are required' });
    }
    await db.query(
      `INSERT INTO schedule_bookings
         (booking_date, slot_time, slot_index, customer_name, phone, vin, notes,
          vehicle_year, vehicle_make, vehicle_model, vehicle_body_style, customer_id, shop_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         customer_name      = VALUES(customer_name),
         phone              = VALUES(phone),
         vin                = VALUES(vin),
         notes              = VALUES(notes),
         vehicle_year       = VALUES(vehicle_year),
         vehicle_make       = VALUES(vehicle_make),
         vehicle_model      = VALUES(vehicle_model),
         vehicle_body_style = VALUES(vehicle_body_style),
         customer_id        = COALESCE(VALUES(customer_id), customer_id)`,
      [date, slot, slotIndex, customerName, phone, vin, notes, vehicleYear, vehicleMake, vehicleModel, vehicleBodyStyle, customerId, req.user.shopId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedule — remove a single slot booking
router.delete('/', authorize('schedule:edit'), async (req, res) => {
  try {
    const { date, slot, slotIndex } = req.body;
    if (!date || !slot || slotIndex === undefined || slotIndex === null) {
      return res.status(400).json({ error: 'date, slot, and slotIndex are required' });
    }
    await db.query(
      'DELETE FROM schedule_bookings WHERE booking_date = ? AND slot_time = ? AND slot_index = ? AND shop_id = ?',
      [date, slot, slotIndex, req.user.shopId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
