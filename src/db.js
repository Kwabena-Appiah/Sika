const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || '';

// Hosted Postgres (Neon, Render, etc.) requires SSL; local Postgres usually doesn't.
// Detect localhost and toggle automatically so the same code runs in both places.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => console.error('Unexpected PG pool error:', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
  async withTransaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  pool,
};