'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const push = require('../services/push');

const router = express.Router();

// The public half of the signing key, which the browser needs before it can
// subscribe. Public by definition - it is handed to every visitor - but still
// behind a sign-in, because there is no reason for a stranger to ask.
router.get('/key', requireAuth, (req, res) => {
  res.json({ configured: push.isConfigured(), key: push.isConfigured() ? push.publicKey() : null });
});

router.post('/subscribe', requireAuth, (req, res) => {
  if (!push.isConfigured()) {
    return res.status(503).json({ error: 'Notifications are not set up on this site.', code: 'push_off' });
  }
  if (!push.subscribe(req.user.id, req.body && req.body.subscription)) {
    return res.status(400).json({ error: 'That subscription could not be read.' });
  }
  res.json({ ok: true, devices: push.countFor(req.user.id) });
});

// Takes the endpoint rather than trusting the session alone: somebody turning
// notifications off on their phone should not silence their laptop.
router.post('/unsubscribe', requireAuth, (req, res) => {
  push.unsubscribe(req.body && req.body.endpoint);
  res.json({ ok: true, devices: push.countFor(req.user.id) });
});

module.exports = router;
