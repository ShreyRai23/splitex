// =============================================================================
// src/config/exchange-rates.js — Static foreign exchange rates
//
// The product spec mandates: "normalize all foreign currencies into INR at the
// EXACT MOMENT of ingestion using a STATIC exchange rate." This means we must
// NOT call a live FX API — the rate is locked in advance and stored in .env.
//
// Why static? Financial audits require reproducibility. If we used live rates,
// recalculating a balance after the fact would give a different answer.
// Locking the rate means the same calculation always produces the same result.
//
// The rate confirmed by the user: USD → INR = ₹84.0
// =============================================================================

const EXCHANGE_RATES = {
  INR: 1.0, // base currency — always 1:1 with itself
  USD: parseFloat(process.env.USD_TO_INR_RATE || '84.0'),
  // Add more currencies here as needed (e.g., EUR: 90.0)
};

/**
 * Convert an amount in a foreign currency to INR.
 * Returns the INR amount and the rate used (for storing in the DB).
 *
 * @param {number} amount
 * @param {string} currency - ISO 4217 currency code (e.g., "USD")
 * @returns {{ amountInr: number, rate: number }}
 */
function toInr(amount, currency) {
  const upperCurrency = (currency || 'INR').toUpperCase().trim();
  const rate = EXCHANGE_RATES[upperCurrency];

  if (rate === undefined) {
    throw new Error(
      `Unsupported currency: "${currency}". Supported: ${Object.keys(EXCHANGE_RATES).join(', ')}`
    );
  }

  return {
    amountInr: parseFloat((amount * rate).toFixed(2)),
    rate: upperCurrency === 'INR' ? null : rate, // store null for INR (no conversion needed)
  };
}

/**
 * Check if a currency code is supported.
 */
function isSupportedCurrency(currency) {
  return Object.keys(EXCHANGE_RATES).includes((currency || '').toUpperCase().trim());
}

module.exports = { EXCHANGE_RATES, toInr, isSupportedCurrency };
