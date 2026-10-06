// authorize('schedule:edit') — must run after authenticate(), which populates req.user.permissions
// from the JWT. Checks the permission name, never the role name, so role → permission mapping
// stays entirely in role_permissions (see db/rbac_schema.sql) instead of scattered in route code.
module.exports = function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({ error: `Missing required permission: ${permission}` });
    }
    next();
  };
};
