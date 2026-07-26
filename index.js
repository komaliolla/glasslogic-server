require('dotenv').config();
const express      = require('express');
const cors         = require('cors');

const customersRouter     = require('./routes/customers');
const businessTypesRouter = require('./routes/businessTypes');
const discountsRouter     = require('./routes/discounts');
const nagsGlassRouter     = require('./routes/nagsGlass');
const glassPartsRouter    = require('./routes/glassParts');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/api/customers',      customersRouter);
app.use('/api/business-types', businessTypesRouter);
app.use('/api/discounts',      discountsRouter);
app.use('/api',                nagsGlassRouter);    // NAGS: makes, models, glass, hardware
app.use('/api',                glassPartsRouter);   // legacy fallback

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`GlassLogic API running on http://localhost:${PORT}`);
});
