const express = require('express');
const db = require('../db');
const { requireAuth, loadBusiness } = require('../middleware/auth');
const { checkRegistration, periodTotals } = require('../lib/vat');

const router = express.Router();
router.use(requireAuth);

// GET /businesses  — only entities the user is a member of
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `select b.id, b.name, b.tin, b.supply_type, b.annual_turnover, m.role
         from businesses b
         join memberships m on m.business_id = b.id
        where m.user_id = $1
        order by b.name`,
      [req.user.id]
    );
    res.json({ businesses: rows });
  } catch (e) { next(e); }
});

// POST /businesses  — create entity + grant creator owner membership atomically
router.post('/', async (req, res, next) => {
  try {
    const { name, tin, supply_type = 'goods', annual_turnover = 0 } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Business name required' });
    if (!['goods', 'services'].includes(supply_type)) return res.status(400).json({ error: 'supply_type must be goods or services' });

    const business = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into businesses (name, tin, supply_type, annual_turnover)
         values ($1, $2, $3, $4) returning *`,
        [name.trim(), tin || null, supply_type, annual_turnover]
      );
      const b = rows[0];
      await client.query(
        `insert into memberships (user_id, business_id, role) values ($1, $2, 'owner')`,
        [req.user.id, b.id]
      );
      return b;
    });
    res.status(201).json({ business });
  } catch (e) { next(e); }
});

// GET /businesses/:businessId  — details + live registration status
router.get('/:businessId', loadBusiness, (req, res) => {
  const b = req.business;
  res.json({
    business: b,
    registration: checkRegistration(b.annual_turnover, b.supply_type),
  });
});

// GET /businesses/:businessId/return?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/:businessId/return', loadBusiness, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const clauses = ['business_id = $1'];
    const params = [req.business.id];
    if (from) { params.push(from); clauses.push(`txn_date >= $${params.length}`); }
    if (to)   { params.push(to);   clauses.push(`txn_date <= $${params.length}`); }
    const { rows } = await db.query(
      `select amount, vat_inclusive, type from transactions where ${clauses.join(' and ')}`,
      params
    );
    res.json({ period: { from: from || null, to: to || null }, count: rows.length, ...periodTotals(rows) });
  } catch (e) { next(e); }
});

module.exports = router;
