require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/businesses');
const transactionRoutes = require('./routes/transactions');
const invoiceRoutes = require('./routes/invoices');
const { rates, asOf } = require('./config/rates');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health + public rate reference (handy for the front end to read live rates).
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/config/rates', (req, res) => res.json({ asOf, rates }));

app.use('/auth', authRoutes);
app.use('/businesses', businessRoutes);
app.use('/', transactionRoutes);   // /businesses/:id/transactions, /transactions/:id
app.use('/', invoiceRoutes);       // /businesses/:id/invoices, /invoices/:id

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — never leak internals to the client.
app.use((err, req, res, next) => {
  // Malformed JSON body.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  // Postgres rejected a value's format (e.g. non-UUID id, bad date) — client error, not a crash.
  if (['22P02', '22007', '22008'].includes(err.code)) return res.status(400).json({ error: 'Invalid input format' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export the app so serverless hosts (Vercel) can wrap it as a handler.
module.exports = app;

// Only bind a port when run directly (local dev, or a long-running host like Render).
// Under Vercel this file is imported, not executed, so we must NOT listen or exit here.
if (require.main === module) {
  // Fail fast on misconfiguration rather than throwing confusing 500s at request time.
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. The API cannot sign or verify tokens without it.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL is not set. The API cannot reach the database.');
    process.exit(1);
  }
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Sika API listening on :${port}`));
}
