const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/customers?search=apex
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql    = 'SELECT * FROM customers';
    let params = [];

    if (search) {
      sql += ' WHERE name LIKE ? OR company LIKE ? OR route LIKE ?';
      const like = `%${search}%`;
      params = [like, like, like];
    }

    sql += ' ORDER BY name';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers  — create new customer
router.post('/', async (req, res) => {
  try {
    const { name, company = '', route = '', phone = '', address = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const [result] = await db.query(
      'INSERT INTO customers (name, company, route, phone, address) VALUES (?, ?, ?, ?, ?)',
      [name.toUpperCase(), company.toUpperCase(), route, phone, address]
    );
    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
