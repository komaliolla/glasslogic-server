const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/schedule?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });
  try {
    const [rows] = await db.query(
      `SELECT slot_time, slot_index, customer_name, phone, vin, notes
       FROM schedule_bookings WHERE booking_date = ?`,
      [date]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule — book or update a single slot
router.put('/', async (req, res) => {
  try {
    const { date, slot, slotIndex, customerName, phone = '', vin = '', notes = '' } = req.body;
    if (!date || !slot || slotIndex === undefined || slotIndex === null || !customerName) {
      return res.status(400).json({ error: 'date, slot, slotIndex, and customerName are required' });
    }
    await db.query(
      `INSERT INTO schedule_bookings
         (booking_date, slot_time, slot_index, customer_name, phone, vin, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         customer_name = VALUES(customer_name),
         phone         = VALUES(phone),
         vin           = VALUES(vin),
         notes         = VALUES(notes)`,
      [date, slot, slotIndex, customerName, phone, vin, notes]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedule — remove a single slot booking
router.delete('/', async (req, res) => {
  try {
    const { date, slot, slotIndex } = req.body;
    if (!date || !slot || slotIndex === undefined || slotIndex === null) {
      return res.status(400).json({ error: 'date, slot, and slotIndex are required' });
    }
    await db.query(
      'DELETE FROM schedule_bookings WHERE booking_date = ? AND slot_time = ? AND slot_index = ?',
      [date, slot, slotIndex]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
