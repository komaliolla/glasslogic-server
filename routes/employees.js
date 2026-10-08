const express = require('express');
const router  = express.Router();
const db      = require('../database/config/userDb');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');

router.use(authenticate, authorize('user:manage'));

// GET /api/employees
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM employees WHERE shop_id = ? ORDER BY name', [req.user.shopId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees
router.post('/', async (req, res) => {
  try {
    const { id, name, total_working_hours = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (id === undefined || id === null || id === '') return res.status(400).json({ error: 'id is required' });

    await db.query(
      'INSERT INTO employees (id, shop_id, name, total_working_hours) VALUES (?, ?, ?, ?)',
      [id, req.user.shopId, name.toUpperCase(), total_working_hours]
    );
    res.status(201).json({ id: Number(id), name: name.toUpperCase(), total_working_hours });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Employee ID already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM employees WHERE id = ? AND shop_id = ?', [req.params.id, req.user.shopId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
