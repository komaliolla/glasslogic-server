const jwt = require('jsonwebtoken');

// Verifies the Bearer JWT and attaches { employeeId, username, role, permissions } to req.user.
module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or malformed Authorization header' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
