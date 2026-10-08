const express = require('express');
const router  = express.Router();
const db      = require('../database/config/userDb');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');

router.use(authenticate, authorize('settings:manage'));

// GET /api/shop-settings — one row per shop, keyed by shop_id (no longer a global singleton)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM shop_settings WHERE shop_id = ?', [req.user.shopId]);
    res.json(rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shop-settings — upsert this shop's settings row
router.put('/', async (req, res) => {
  try {
    const {
      name = '', address = '', city = '', state = '', zip = '',
      phone = '', fax = '', fin_url = '',
      print_headers = 'Yes', network_print = 'Yes',
    } = req.body;

    await db.query(
      `INSERT INTO shop_settings (shop_id, name, address, city, state, zip, phone, fax, fin_url, print_headers, network_print)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), address = VALUES(address), city = VALUES(city),
         state = VALUES(state), zip = VALUES(zip), phone = VALUES(phone),
         fax = VALUES(fax), fin_url = VALUES(fin_url),
         print_headers = VALUES(print_headers), network_print = VALUES(network_print)`,
      [req.user.shopId, name, address, city, state, zip, phone, fax, fin_url, print_headers, network_print]
    );

    const [rows] = await db.query('SELECT * FROM shop_settings WHERE shop_id = ?', [req.user.shopId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
