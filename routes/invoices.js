const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

const toRecord = r => ({
  id:           r.id,
  date:         r.date,
  billTo:       r.bill_to,
  soldTo:       r.sold_to,
  installDate:  r.install_date,
  status:       r.status,
  amount:       parseFloat(r.amount) || 0,
  paidDate:     r.paid_date,
  checkNumber:  r.check_number,
  checkAmount:  parseFloat(r.check_amount) || 0,
  adjustment:   parseFloat(r.adjustment) || 0,
});

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM invoices ORDER BY id DESC');
    res.json(rows.map(toRecord));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices — create or update (upsert by id)
router.put('/', async (req, res) => {
  try {
    const {
      id, date = '', billTo = '', soldTo = '', installDate = '',
      status = 'Draft', amount = 0,
      paidDate = '', checkNumber = '', checkAmount = 0, adjustment = 0,
    } = req.body;

    if (id === undefined || id === null) {
      return res.status(400).json({ error: 'id is required' });
    }

    await db.query(
      `INSERT INTO invoices
         (id, date, bill_to, sold_to, install_date, status, amount, paid_date, check_number, check_amount, adjustment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         date         = VALUES(date),
         bill_to      = VALUES(bill_to),
         sold_to      = VALUES(sold_to),
         install_date = VALUES(install_date),
         status       = VALUES(status),
         amount       = VALUES(amount),
         paid_date    = VALUES(paid_date),
         check_number = VALUES(check_number),
         check_amount = VALUES(check_amount),
         adjustment   = VALUES(adjustment)`,
      [id, date, billTo, soldTo, installDate, status, amount, paidDate, checkNumber, checkAmount, adjustment]
    );

    const [[row]] = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json(toRecord(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM invoices WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
