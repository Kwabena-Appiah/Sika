// Vercel serverless entry point.
// Every request (see vercel.json rewrites) is routed here; the Express app
// handles the original path itself, so all existing routes work unchanged.
module.exports = require('../src/server');
