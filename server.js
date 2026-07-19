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
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Sika API listening on :${port}`));

module.exports = app;
