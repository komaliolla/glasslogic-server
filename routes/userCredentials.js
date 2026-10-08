const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcrypt');
const crypto    = require('crypto');
const db        = require('../database/config/userDb');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const logAudit      = require('../middleware/auditLog');

router.use(authenticate, authorize('user:manage'));

// Mirrors scripts/migrate_to_multitenant.js — the 6-digit User ID range each role's logins
// are allocated from. user_id is globally unique (login is User ID + Password, no Shop #),
// so these blocks are shared across every shop, not per-shop. Keep these two in sync if the
// ranges ever change.
const ROLE_BLOCKS = {
  Manager:    100001,
  CSR:        200001,
  Technician: 300001,
};
const BLOCK_SIZE = 99999;

const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function randomPassword(length = 10) {
  return Array.from(crypto.randomBytes(length)).map(b => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('');
}

async function nextUserId(roleName) {
  const base = ROLE_BLOCKS[roleName];
  if (!base) throw new Error(`No User ID block defined for role "${roleName}"`);
  const [[row]] = await db.query(
    'SELECT MAX(user_id) AS maxId FROM user_credentials WHERE user_id BETWEEN ? AND ?',
    [base, base + BLOCK_SIZE - 1]
  );
  return row.maxId ? row.maxId + 1 : base;
}

// GET /api/user-credentials/roles — the fixed role list, for the role picker (roles/permissions
// are global, not per-shop — see db/rbac_schema.sql). Registered before /:employeeId so
// Express doesn't swallow "roles" as an employeeId.
router.get('/roles', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/user-credentials — every employee at this shop, with login status, role, and User ID
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.id AS employee_id, e.name, uc.user_id, uc.is_active, r.name AS role, r.id AS role_id
       FROM employees e
       LEFT JOIN user_credentials uc ON uc.employee_id = e.id
       LEFT JOIN roles r ON r.id = uc.role_id
       WHERE e.shop_id = ?
       ORDER BY e.name`,
      [req.user.shopId]
    );
    res.json(rows.map(r => ({ ...r, has_login: r.user_id !== null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user-credentials/:employeeId — create a login, or change role (which reassigns
// the User ID into the new role's block) / regenerate the password for an existing one.
// System-provisioned, like the customer portal: returns the temp password once.
router.post('/:employeeId', async (req, res) => {
  try {
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ error: 'roleId is required' });

    const [[employee]] = await db.query('SELECT id FROM employees WHERE id = ? AND shop_id = ?', [req.params.employeeId, req.user.shopId]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const [[role]] = await db.query('SELECT id, name FROM roles WHERE id = ?', [roleId]);
    if (!role) return res.status(400).json({ error: 'Unknown role' });

    const [[existing]] = await db.query(
      'SELECT user_id, role_id FROM user_credentials WHERE employee_id = ? AND shop_id = ?',
      [req.params.employeeId, req.user.shopId]
    );

    const userId = (existing && existing.role_id === role.id)
      ? existing.user_id
      : await nextUserId(role.name);

    const tempPassword = randomPassword();
    const password_hash = await bcrypt.hash(tempPassword, 10);

    await db.query(
      `INSERT INTO user_credentials (employee_id, shop_id, user_id, password_hash, role_id, is_active, must_change_password)
       VALUES (?, ?, ?, ?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), password_hash = VALUES(password_hash),
         role_id = VALUES(role_id), is_active = 1, must_change_password = 1`,
      [req.params.employeeId, req.user.shopId, userId, password_hash, role.id]
    );

    if (existing && existing.role_id !== role.id) {
      logAudit({
        shopId: req.user.shopId,
        employeeId: req.user.employeeId,
        action: 'role_changed',
        targetType: 'user_credentials',
        targetId: req.params.employeeId,
        details: `role_id ${existing.role_id ?? 'none'} -> ${role.id}`,
      });
    }

    res.json({ employeeId: Number(req.params.employeeId), userId, tempPassword, role: role.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/user-credentials/:employeeId/active — soft deactivate/reactivate (never hard-delete a login with history)
router.patch('/:employeeId/active', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) is required' });

    const [result] = await db.query(
      'UPDATE user_credentials SET is_active = ? WHERE employee_id = ? AND shop_id = ?',
      [isActive, req.params.employeeId, req.user.shopId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });

    logAudit({
      shopId: req.user.shopId,
      employeeId: req.user.employeeId,
      action: isActive ? 'user_reactivated' : 'user_deactivated',
      targetType: 'user_credentials',
      targetId: req.params.employeeId,
    });
    res.json({ employeeId: Number(req.params.employeeId), isActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/user-credentials/:employeeId — remove an employee's login
router.delete('/:employeeId', async (req, res) => {
  try {
    await db.query('DELETE FROM user_credentials WHERE employee_id = ? AND shop_id = ?', [req.params.employeeId, req.user.shopId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
