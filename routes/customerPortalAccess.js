const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const db      = require('../../database/config/db');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');

// Mounted at the same /api/customers prefix as routes/customers.js (see index.js) — same
// pattern as nagsGlass.js + glassParts.js sharing /api. Only matches /:id/portal-access*.
router.use(authenticate, authorize('customer:manage'));

// Avoids visually ambiguous characters (0/O, 1/I/L) since staff hand these to customers
// verbally or on paper.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode(length) {
  return Array.from(crypto.randomBytes(length))
    .map(b => CODE_CHARS[b % CODE_CHARS.length])
    .join('');
}

async function generateUniqueLoginId() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomCode(8);
    const [rows] = await db.query('SELECT id FROM customer_credentials WHERE login_id = ?', [candidate]);
    if (rows.length === 0) return candidate;
  }
  throw new Error('Could not generate a unique login ID, try again');
}

// POST /api/customers/:id/portal-access — create or regenerate a customer's portal login.
// Returns the temp password once; it is never retrievable again after this response.
router.post('/:id/portal-access', async (req, res) => {
  try {
    const [[customer]] = await db.query('SELECT id FROM customers WHERE id = ? AND shop_id = ?', [req.params.id, req.user.shopId]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const loginId = await generateUniqueLoginId();
    const tempPassword = randomCode(10);
    const password_hash = await bcrypt.hash(tempPassword, 10);

    await db.query(
      `INSERT INTO customer_credentials (customer_id, shop_id, login_id, password_hash, is_active, must_change_password)
       VALUES (?, ?, ?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE login_id = VALUES(login_id), password_hash = VALUES(password_hash),
         is_active = 1, must_change_password = 1`,
      [req.params.id, req.user.shopId, loginId, password_hash]
    );

    res.json({ customerId: Number(req.params.id), loginId, tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id/portal-access — status only, never the password.
router.get('/:id/portal-access', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT login_id, is_active, must_change_password, last_login_at FROM customer_credentials WHERE customer_id = ? AND shop_id = ?',
      [req.params.id, req.user.shopId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/customers/:id/portal-access/active
router.patch('/:id/portal-access/active', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) is required' });

    const [result] = await db.query(
      'UPDATE customer_credentials SET is_active = ? WHERE customer_id = ? AND shop_id = ?',
      [isActive, req.params.id, req.user.shopId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ customerId: Number(req.params.id), isActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id/portal-access — revoke
router.delete('/:id/portal-access', async (req, res) => {
  try {
    await db.query('DELETE FROM customer_credentials WHERE customer_id = ? AND shop_id = ?', [req.params.id, req.user.shopId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
