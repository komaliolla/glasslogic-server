const db = require('../../database/config/userDb');

// One row per sensitive action (role changes, EDI sends) — see db/rbac_schema.sql's
// user_audit_log. Fire-and-forget by design: a logging failure shouldn't block the
// request it's describing, so callers don't need to await or wrap this in try/catch.
function logAudit({ shopId, employeeId, action, targetType = null, targetId = null, details = null }) {
  db.query(
    `INSERT INTO user_audit_log (shop_id, employee_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [shopId, employeeId, action, targetType, targetId, details]
  ).catch(err => console.error('audit log write failed:', err.message));
}

module.exports = logAudit;
