const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../database/config/userDb');
const authenticate = require('../middleware/authenticate');
const loginRateLimit = require('../middleware/loginRateLimit');

// POST /api/auth/login
// Staff log in with a 6-digit numeric User ID (globally unique) + password — not a username,
// and no Shop # field. See database/schema/shops_user_db.sql and scripts/migrate_to_multitenant.js.
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }

    const [rows] = await db.query(
      `SELECT uc.password_hash, uc.is_active, uc.must_change_password, uc.shop_id, uc.user_id,
              e.id AS employee_id, e.name, r.id AS role_id, r.name AS role_name
       FROM user_credentials uc
       JOIN employees e ON e.id = uc.employee_id
       LEFT JOIN roles r ON r.id = uc.role_id
       WHERE uc.user_id = ?`,
      [userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid User ID or password' });

    const account = rows[0];
    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid User ID or password' });
    if (!account.is_active) return res.status(403).json({ error: 'This account has been deactivated' });
    if (!account.role_id) return res.status(403).json({ error: 'This account has no role assigned' });

    const [permRows] = await db.query(
      `SELECT p.name FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [account.role_id]
    );
    const permissions = permRows.map(p => p.name);

    const token = jwt.sign(
      {
        employeeId: account.employee_id, shopId: account.shop_id, userId: account.user_id,
        role: account.role_name, permissions, type: 'staff',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await db.query('UPDATE user_credentials SET last_login_at = NOW() WHERE user_id = ?', [userId]);

    res.json({
      token,
      user: {
        employeeId: account.employee_id, shopId: account.shop_id, userId: account.user_id,
        name: account.name, role: account.role_name, permissions,
        mustChangePassword: !!account.must_change_password,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password — forced on first login for system-provisioned accounts
// (see routes/userCredentials.js), same shape as the customer portal's equivalent. Requires
// the current password so a stolen/short-lived token can't be turned into a permanent
// takeover by just setting a new one.
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ error: 'currentPassword is required' });
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword is required (min 8 characters)' });
    }

    const [[account]] = await db.query(
      'SELECT password_hash FROM user_credentials WHERE shop_id = ? AND user_id = ?',
      [req.user.shopId, req.user.userId]
    );
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const match = await bcrypt.compare(currentPassword, account.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE user_credentials SET password_hash = ?, must_change_password = 0 WHERE shop_id = ? AND user_id = ?',
      [password_hash, req.user.shopId, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
