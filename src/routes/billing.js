'use strict';

const express = require('express');
const Stripe = require('stripe');
const { db, transaction } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const usage = require('../services/usage');
const zarinpal = require('../services/zarinpal');
const discounts = require('../services/discounts');

const router = express.Router();

let stripeClient = null;
function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key);
  return stripeClient;
}

// Stripe needs absolute URLs to send the customer back to. Behind a TLS-terminating
// proxy `req.protocol` only reports https once `trust proxy` is on (set in server.js);
// APP_URL is an explicit override for hosts whose forwarded headers differ.
function appOrigin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function billingNotConfigured(res) {
  return res.status(503).json({
    error: 'Billing is not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID to enable upgrades.',
    code: 'billing_not_configured',
  });
}


// --- ZarinPal ---------------------------------------------------------------

async function startZarinpalCheckout(req, res) {
  const { plan, code } = req.body || {};

  if (!usage.PAID_PLANS.includes(plan)) {
    return res.status(400).json({ error: 'Choose a plan first.', code: 'no_plan' });
  }

  // The price comes from the server's own table, never from the request. A
  // posted amount would let anyone name their own.
  const listPrice = usage.planPriceRial(plan);

  const check = discounts.validate(code, req.user.id);
  if (!check.ok) {
    return res.status(400).json({ error: 'That discount code cannot be used.', code: `discount_${check.reason}` });
  }

  const amountRial = discounts.applyTo(listPrice, check.percent || 0);
  const origin = appOrigin(req);

  const { authority, url } = await zarinpal.requestPayment({
    amountRial,
    callbackUrl: `${origin}/api/billing/callback`,
    description: `Buddy — ${plan}`,
    email: req.user.email,
  });

  // Recorded before the payer leaves. The callback is a plain browser redirect
  // and carries nothing but an authority, so everything needed to finish -
  // who, which plan, how much - has to already be here.
  db.prepare(
    `INSERT INTO payments (user_id, authority, amount, plan, discount_code, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    req.user.id,
    authority,
    amountRial,
    plan,
    check.percent ? code.trim().toUpperCase() : null,
    new Date().toISOString()
  );

  res.json({ url });
}

router.get('/', requireAuth, (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id);
  const { plan, usage: usageSummary } = usage.getUsageSummary(req.user.id);
  res.json({
    plan,
    status: sub ? sub.status : 'active',
    currentPeriodEnd: sub ? sub.current_period_end : null,
    usage: usageSummary,
    tracks: usage.tracksFor(plan),
    plans: usage.PAID_PLANS.map((key) => ({
      key,
      priceRial: usage.PLAN_LIMITS[key].priceRial,
      tracks: usage.PLAN_LIMITS[key].tracks,
      messagesPerDay: usage.PLAN_LIMITS[key].ai_messages.limit,
    })),
    billingConfigured: zarinpal.isConfigured() || Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
    discountCode: (() => {
      const own = discounts.forUser(req.user.id);
      return own && !own.used_at ? { code: own.code, percent: own.percent } : null;
    })(),
  });
});

// ZarinPal when it is configured, which on an Iranian deployment it always
// will be; Stripe only as the fallback for a deployment somewhere it works.
router.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (zarinpal.isConfigured()) return startZarinpalCheckout(req, res);

    const stripe = getStripe();
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!stripe || !priceId) return billingNotConfigured(res);

    const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id);
    let customerId = sub && sub.billing_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: String(req.user.id) },
      });
      customerId = customer.id;
      db.prepare('UPDATE subscriptions SET billing_customer_id = ?, updated_at = ? WHERE user_id = ?').run(
        customerId,
        new Date().toISOString(),
        req.user.id
      );
    }

    const origin = appOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?upgraded=1`,
      cancel_url: `${origin}/?upgrade_cancelled=1`,
      metadata: { userId: String(req.user.id) },
    });

    res.json({ url: session.url });
  })
);


// Where ZarinPal sends the payer back. A plain browser redirect with no
// session and no signature, so nothing here is trusted: the authority is
// looked up in our own table, and the money is only real once verify says so.
//
// Deliberately not behind requireAuth - the payer may return in a different
// tab or after the cookie expired, and the payment still has to complete.
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const authority = req.query.Authority || req.query.authority;
    const status = req.query.Status || req.query.status;

    const done = (outcome) => res.redirect(`/app?payment=${outcome}`);

    if (!authority) return done('missing');

    const payment = db.prepare('SELECT * FROM payments WHERE authority = ?').get(String(authority));
    if (!payment) return done('unknown');

    // Already settled: a refresh, a back button, a second tab. Report the
    // original outcome rather than asking the gateway again.
    if (payment.status === 'paid') return done('ok');

    // The payer cancelled at the gateway.
    if (status !== 'OK') {
      db.prepare("UPDATE payments SET status = 'failed', settled_at = ? WHERE id = ?")
        .run(new Date().toISOString(), payment.id);
      return done('cancelled');
    }

    const result = await zarinpal.verifyPayment({ amountRial: payment.amount, authority: payment.authority });

    if (!result.paid) {
      db.prepare("UPDATE payments SET status = 'failed', settled_at = ? WHERE id = ?")
        .run(new Date().toISOString(), payment.id);
      return done('failed');
    }

    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();

    // The plan, the code and the subscription all move together, so a crash
    // between them cannot leave someone charged without their plan or with a
    // code silently spent.
    transaction(() => {
      db.prepare("UPDATE payments SET status = 'paid', ref_id = ?, settled_at = ? WHERE id = ?")
        .run(result.refId, now, payment.id);

      db.prepare(
        `UPDATE subscriptions
            SET plan = ?, status = 'active', billing_provider = 'zarinpal',
                current_period_end = ?, updated_at = ?
          WHERE user_id = ?`
      ).run(payment.plan, periodEnd, now, payment.user_id);

      // Only now. Marking it at checkout would burn the code of anyone who
      // changed their mind at the gateway.
      if (payment.discount_code) discounts.markUsed(payment.discount_code);
    });

    done('ok');
  })
);

router.post(
  '/portal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return billingNotConfigured(res);

    const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id);
    if (!sub || !sub.billing_customer_id) {
      return res.status(400).json({ error: 'No billing account found yet — upgrade first.' });
    }

    const origin = appOrigin(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.billing_customer_id,
      return_url: `${origin}/`,
    });

    res.json({ url: session.url });
  })
);

// No requireAuth here — Stripe calls this directly, with no user session cookie.
// Must receive the raw request body (mounted with express.raw() in server.js, ahead of express.json()).
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) {
      return res.status(503).send('Billing webhook not configured.');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }

    const now = new Date().toISOString();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = Number(session.metadata && session.metadata.userId);
        if (userId) {
          db.prepare(
            `UPDATE subscriptions SET plan = 'paid', status = 'active', billing_provider = 'stripe',
               billing_customer_id = ?, billing_subscription_id = ?, updated_at = ?
             WHERE user_id = ?`
          ).run(session.customer, session.subscription, now, userId);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
        const plan = status === 'active' ? 'paid' : 'free';
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        db.prepare(
          `UPDATE subscriptions SET plan = ?, status = ?, current_period_end = ?, updated_at = ?
           WHERE billing_customer_id = ?`
        ).run(plan, status, periodEnd, now, sub.customer);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        db.prepare(
          `UPDATE subscriptions SET plan = 'free', status = 'canceled', updated_at = ? WHERE billing_customer_id = ?`
        ).run(now, sub.customer);
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  })
);

module.exports = router;
