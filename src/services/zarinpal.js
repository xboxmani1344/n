'use strict';

// ZarinPal, the gateway Iranian customers can actually pay through.
//
// A redirect flow, not a hosted subscription: ask for an authority, send the
// payer to the gateway, and verify when they come back. Nothing is credited
// until verify says so - the return URL is just a browser redirect and anyone
// can visit it.

const REQUEST_URL = 'https://api.zarinpal.com/pg/v4/payment/request.json';
const VERIFY_URL = 'https://api.zarinpal.com/pg/v4/payment/verify.json';
const START_PAY_URL = 'https://payment.zarinpal.com/pg/StartPay';

const TIMEOUT_MS = 20000;

// ZarinPal's own unit is Rial, and the currency is stated explicitly so it
// never depends on an account default.
//
// The one rule that matters: whatever is charged here is what the customer was
// shown. Prices are configured in Rial, and the interface divides by ten to
// display Toman, because Toman is what Iranians read prices in. One number,
// converted for display only - never two numbers that could drift apart.
const CURRENCY = 'IRR';

function merchantId() {
  return process.env.ZARINPAL_MERCHANT_ID || null;
}

function isConfigured() {
  return Boolean(merchantId());
}

function startPayUrl(authority) {
  return `${START_PAY_URL}/${authority}`;
}

function fail(message, code, status = 502) {
  return Object.assign(new Error(message), { status, code });
}

async function post(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  let raw;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    raw = await res.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw fail('The payment gateway did not respond in time. Please try again.', 'gateway_timeout', 504);
    }
    throw fail('Could not reach the payment gateway. Please try again.', 'gateway_unreachable');
  } finally {
    clearTimeout(timer);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A gateway behind a captive portal or an error page returns HTML. Saying
    // so beats showing the payer a wall of markup.
    throw fail('The payment gateway returned something unexpected. Please try again.', 'gateway_bad_response');
  }

  // ZarinPal answers with either data or errors, and errors can be an array or
  // an object depending on what went wrong.
  const errors = parsed.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
  if (hasErrors) {
    const first = Array.isArray(errors) ? errors[0] : errors;
    const detail = (first && (first.message || first.code)) || 'unknown error';
    throw fail(`The payment gateway refused the request (${detail}).`, 'gateway_rejected');
  }

  return parsed.data || {};
}

// Returns { authority, url } - send the payer to url.
async function requestPayment({ amountRial, callbackUrl, description, email }) {
  if (!isConfigured()) {
    throw fail('Online payment is not set up yet.', 'payment_not_configured', 503);
  }

  const data = await post(REQUEST_URL, {
    merchant_id: merchantId(),
    amount: amountRial,
    currency: CURRENCY,
    callback_url: callbackUrl,
    description,
    metadata: email ? { email } : undefined,
  });

  // 100 is the only success code for a request.
  if (data.code !== 100 || !data.authority) {
    throw fail('The payment gateway did not open a payment session.', 'gateway_no_authority');
  }

  return { authority: data.authority, url: startPayUrl(data.authority) };
}

// Returns { paid, refId, alreadyVerified }. The amount must match the one sent
// at request time, which is why it is stored rather than recalculated.
async function verifyPayment({ amountRial, authority }) {
  if (!isConfigured()) {
    throw fail('Online payment is not set up yet.', 'payment_not_configured', 503);
  }

  const data = await post(VERIFY_URL, {
    merchant_id: merchantId(),
    amount: amountRial,
    currency: CURRENCY,
    authority,
  });

  // 100 is a fresh success. 101 means this one was already verified - which
  // happens whenever a payer refreshes the return page, and is a success, not
  // an error. Treating it as a failure would tell someone who paid that they
  // had not.
  if (data.code === 100 || data.code === 101) {
    return { paid: true, refId: String(data.ref_id || ''), alreadyVerified: data.code === 101 };
  }

  return { paid: false, refId: null, alreadyVerified: false };
}

// Display only. The charge is always the Rial figure above.
function toToman(rial) {
  return Math.round(rial / 10);
}

module.exports = {
  isConfigured,
  toToman,
  requestPayment,
  verifyPayment,
  CURRENCY,
};
