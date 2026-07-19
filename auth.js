const jwt = require('jsonwebtoken');
const db = require('../db');

// Verify the Bearer token and attach req.user = { id }.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// AUTHORIZATION, not just authentication: confirm the logged-in user
// actually belongs to the business in :businessId. This runs on every
// business-scoped route so users can never read another entity's data.
async function loadBusiness(req, res, next) {
  const businessId = req.params.businessId;
  try {
    const { rows } = await db.query(
      `select b.*, m.role
         from businesses b
         join memberships m on m.business_id = b.id
        where b.id = $1 and m.user_id = $2`,
      [businessId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Business not found' });
    req.business = rows[0];
    req.role = rows[0].role;
    next();
  } catch (e) { next(e); }
}

// Block write actions for viewer-role members.
function requireWrite(req, res, next) {
  if (req.role === 'viewer') return res.status(403).json({ error: 'Read-only access' });
  next();
}

module.exports = { requireAuth, loadBusiness, requireWrite };
