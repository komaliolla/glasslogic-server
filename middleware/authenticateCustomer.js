const jwt = require('jsonwebtoken');

// Verifies the Bearer JWT for the customer portal and attaches { customerId, loginId } to
// req.customer. Requires the `type: 'customer'` claim so a staff token (see authenticate.js /
// routes/auth.js) can never authenticate here, and a customer token can never pass authenticate().
module.exports = function authenticateCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or malformed Authorization header' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer') return res.status(401).json({ error: 'Invalid or expired token' });
    req.customer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
