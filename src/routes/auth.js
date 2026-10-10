const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Same cost as real hashes, so a login for an unknown email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('sika-timing-dummy', 10);

const isEmail = (s) => typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!isEmail(email)) return res.status(400).json({ error: 'Valid email required' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `insert into users (email, password_hash, name)
       values (lower($1), $2, $3)
       returning id, email, name, created_at`,
      [email, hash, name.trim()]
    );
    return res.status(201).json({ token: signToken(rows[0].id), user: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(e);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const { rows } = await db.query('select * from users where email = lower($1)', [email || '']);
    const user = rows[0];
    // Compare even when user is missing to avoid leaking which emails exist (timing).
    const ok = await bcrypt.compare(String(password || ''), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password' });
    return res.json({
      token: signToken(user.id),
      user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
    });
  } catch (e) { next(e); }
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('select id, email, name, created_at from users where id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
