// ============================================================
// THE SINGLE SOURCE OF TRUTH FOR RATES (server side).
// Mirrors the front-end CONFIG. When a budget changes rates,
// edit here, verify against gra.gov.gh, redeploy.
// Production evolution: replace with an effective-dated lookup
// from the tax_rates table (see schema.sql) so historical
// transactions keep the rate that applied on their date.
// ============================================================
module.exports = {
  asOf: '2026 (Act 1151)',
  rates: { vat: 0.15, nhil: 0.025, getfund: 0.025, covidLevy: 0 }, // COVID levy abolished 1 Jan 2026
  registration: { goodsThreshold: 750000, servicesMandatory: true },
};
