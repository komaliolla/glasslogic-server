const express = require('express');
const router  = express.Router();
const db      = require('../../database/config/db');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

// GET /api/business-types
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM business_types WHERE shop_id = ? ORDER BY name', [req.user.shopId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business-types
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const [result] = await db.query(
      'INSERT INTO business_types (shop_id, name) VALUES (?, ?)',
      [req.user.shopId, name.toUpperCase()]
    );
    res.status(201).json({ id: result.insertId, name: name.toUpperCase() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Business type already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/business-types/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM business_types WHERE id = ? AND shop_id = ?', [req.params.id, req.user.shopId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
