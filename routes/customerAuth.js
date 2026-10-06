const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../../database/config/db');
const authenticateCustomer = require('../middleware/authenticateCustomer');

// POST /api/customer-auth/login
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ error: 'Login ID and password are required' });

    const [rows] = await db.query(
      `SELECT cc.password_hash, cc.is_active, cc.must_change_password, cc.shop_id, c.id AS customer_id, c.name
       FROM customer_credentials cc
       JOIN customers c ON c.id = cc.customer_id
       WHERE cc.login_id = ?`,
      [loginId]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid login ID or password' });

    const account = rows[0];
    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid login ID or password' });
    if (!account.is_active) return res.status(403).json({ error: 'This account has been deactivated' });

    const token = jwt.sign(
      { customerId: account.customer_id, shopId: account.shop_id, loginId, type: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '24h' }
    );

    await db.query('UPDATE customer_credentials SET last_login_at = NOW() WHERE customer_id = ?', [account.customer_id]);

    res.json({
      token,
      customer: { customerId: account.customer_id, shopId: account.shop_id, name: account.name, mustChangePassword: !!account.must_change_password },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer-auth/change-password
router.post('/change-password', authenticateCustomer, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword is required (min 8 characters)' });
    }
    const password_hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE customer_credentials SET password_hash = ?, must_change_password = 0 WHERE customer_id = ?',
      [password_hash, req.customer.customerId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
