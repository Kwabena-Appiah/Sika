const express = require('express');
const db = require('../db');
const { requireAuth, loadBusiness, requireWrite } = require('../middleware/auth');
const { computeVat } = require('../lib/vat');

const router = express.Router();
router.use(requireAuth);

// Attach computed VAT to a stored row for the client.
const withVat = (t) => ({ ...t, computed: computeVat(t.amount, t.vat_inclusive) });

// GET /businesses/:businessId/transactions
router.get('/businesses/:businessId/transactions', loadBusiness, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `select id, description, amount, vat_inclusive, type, txn_date, created_at
         from transactions where business_id = $1
        order by txn_date desc, created_at desc`,
      [req.business.id]
    );
    res.json({ transactions: rows.map(withVat) });
  } catch (e) { next(e); }
});

// POST /businesses/:businessId/transactions
router.post('/businesses/:businessId/transactions', loadBusiness, requireWrite, async (req, res, next) => {
  try {
    const { description, amount, vat_inclusive = false, type, txn_date } = req.body || {};
    if (!type || !['sale', 'purchase'].includes(type)) return res.status(400).json({ error: 'type must be sale or purchase' });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return res.status(400).json({ error: 'amount must be a positive number' });

    const { rows } = await db.query(
      `insert into transactions (business_id, description, amount, vat_inclusive, type, txn_date, created_by)
       values ($1, $2, $3, $4, $5, coalesce($6, current_date), $7)
       returning id, description, amount, vat_inclusive, type, txn_date, created_at`,
      [req.business.id, (description || (type === 'sale' ? 'Sale' : 'Purchase')).trim(), amt, !!vat_inclusive, type, txn_date || null, req.user.id]
    );
    res.status(201).json({ transaction: withVat(rows[0]) });
  } catch (e) { next(e); }
});

// DELETE /transactions/:id  — membership re-checked via the row's business
router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `delete from transactions t
        using memberships m
        where t.id = $1 and m.business_id = t.business_id
          and m.user_id = $2 and m.role <> 'viewer'
        returning t.id`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Transaction not found or not permitted' });
    res.json({ deleted: rows[0].id });
  } catch (e) { next(e); }
});

module.exports = router;
