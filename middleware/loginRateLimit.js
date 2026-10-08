const rateLimit = require('express-rate-limit');

// Closes a security-scan finding: login had no throttling at all, allowing unlimited
// automated password guessing. 10 attempts per 15 minutes per IP — generous enough for
// a legitimate user who mistypes a password a few times, tight enough to make online
// brute-forcing impractical. Shared by staff and customer-portal login alike.
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});
