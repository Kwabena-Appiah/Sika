// Pure VAT engine — identical logic to the front-end prototype.
const { rates, registration } = require('../config/rates');

const K = 1 + rates.vat + rates.nhil + rates.getfund; // combined multiplier on the base (1.20)

// Money note: cedi amounts are small enough that float + round-to-2dp is safe here.
// For a hardened build, compute in integer pesewas or use decimal.js.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function computeVat(amount, inclusive) {
  const a = Number(amount) || 0;
  const base = inclusive ? a / K : a;
  return {
    base: round2(base),
    nhil: round2(base * rates.nhil),
    getfund: round2(base * rates.getfund),
    vat: round2(base * rates.vat),
    total: round2(base * K),
  };
}

function checkRegistration(turnover, type) {
  if (type === 'services' && registration.servicesMandatory) {
    return { must: true, reason: 'Services must register regardless of turnover (Act 1151).' };
  }
  const t = registration.goodsThreshold;
  return Number(turnover) >= t
    ? { must: true, reason: `Turnover meets or exceeds the GH\u20B5${t.toLocaleString()} goods threshold.` }
    : { must: false, reason: `Below the GH\u20B5${t.toLocaleString()} goods threshold — registration is voluntary.` };
}

// Roll a set of transaction rows up into a VAT return.
function periodTotals(txns) {
  let output = 0, input = 0;
  for (const t of txns) {
    const v = computeVat(t.amount, t.vat_inclusive).vat;
    if (t.type === 'sale') output += v; else input += v;
  }
  output = round2(output); input = round2(input);
  return { output, input, net: round2(output - input) };
}

module.exports = { computeVat, checkRegistration, periodTotals, K };
