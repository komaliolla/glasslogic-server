const express = require('express');
const router  = express.Router();
const db      = require('../../database/config/userDb');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');

router.use(authenticate, authorize('settings:manage'));

// GET /api/tax-rates
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tax_rates WHERE shop_id = ? ORDER BY store', [req.user.shopId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tax-rates
router.post('/', async (req, res) => {
  try {
    const { store, taxRate } = req.body;
    if (!store || !store.trim()) return res.status(400).json({ error: 'store is required' });
    if (taxRate === undefined || taxRate === null || isNaN(taxRate)) return res.status(400).json({ error: 'taxRate is required' });

    const [result] = await db.query(
      'INSERT INTO tax_rates (shop_id, store, tax_rate) VALUES (?, ?, ?)',
      [req.user.shopId, store.trim(), taxRate]
    );
    const [rows] = await db.query('SELECT * FROM tax_rates WHERE id = ? AND shop_id = ?', [result.insertId, req.user.shopId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Store already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tax-rates/:id
router.put('/:id', async (req, res) => {
  try {
    const { store, taxRate } = req.body;
    if (!store || !store.trim()) return res.status(400).json({ error: 'store is required' });
    if (taxRate === undefined || taxRate === null || isNaN(taxRate)) return res.status(400).json({ error: 'taxRate is required' });

    await db.query('UPDATE tax_rates SET store = ?, tax_rate = ? WHERE id = ? AND shop_id = ?', [store.trim(), taxRate, req.params.id, req.user.shopId]);
    const [rows] = await db.query('SELECT * FROM tax_rates WHERE id = ? AND shop_id = ?', [req.params.id, req.user.shopId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Store already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tax-rates/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM tax_rates WHERE id = ? AND shop_id = ?', [req.params.id, req.user.shopId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
