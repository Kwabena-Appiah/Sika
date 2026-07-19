const express = require('express');
const db = require('../db');
const { requireAuth, loadBusiness, requireWrite } = require('../middleware/auth');
const { computeVat } = require('../lib/vat');

const router = express.Router();
router.use(requireAuth);

// GET /businesses/:businessId/invoices
router.get('/businesses/:businessId/invoices', loadBusiness, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `select id, invoice_no, customer_name, issue_date, created_at
         from invoices where business_id = $1 order by created_at desc`,
      [req.business.id]
    );
    res.json({ invoices: rows });
  } catch (e) { next(e); }
});

// GET /invoices/:id  — full invoice with lines and computed totals
router.get('/invoices/:id', async (req, res, next) => {
  try {
    const inv = await db.query(
      `select i.* from invoices i
         join memberships m on m.business_id = i.business_id
        where i.id = $1 and m.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const lines = await db.query(
      `select id, description, quantity, unit_price from invoice_lines where invoice_id = $1`,
      [req.params.id]
    );
    const base = lines.rows.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
    res.json({ invoice: inv.rows[0], lines: lines.rows, totals: computeVat(base, false) });
  } catch (e) { next(e); }
});

// POST /businesses/:businessId/invoices  — create invoice + lines atomically
router.post('/businesses/:businessId/invoices', loadBusiness, requireWrite, async (req, res, next) => {
  try {
    const { invoice_no, customer_name, issue_date, lines = [] } = req.body || {};
    if (!invoice_no || !invoice_no.trim()) return res.status(400).json({ error: 'invoice_no required' });
    if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ error: 'At least one line item required' });

    const result = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into invoices (business_id, invoice_no, customer_name, issue_date, created_by)
         values ($1, $2, $3, coalesce($4, current_date), $5) returning *`,
        [req.business.id, invoice_no.trim(), customer_name || null, issue_date || null, req.user.id]
      );
      const invoice = rows[0];
      for (const l of lines) {
        await client.query(
          `insert into invoice_lines (invoice_id, description, quantity, unit_price)
           values ($1, $2, $3, $4)`,
          [invoice.id, (l.description || '').trim(), Number(l.quantity) || 0, Number(l.unit_price) || 0]
        );
      }
      return invoice;
    });
    res.status(201).json({ invoice: result });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Invoice number already used for this business' });
    next(e);
  }
});

module.exports = router;
