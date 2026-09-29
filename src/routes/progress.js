'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const progress = require('../services/progress');

const router = express.Router();
router.use(requireAuth);

// Everything Home needs to say "you have kept this up, and here is how long is
// left" - in one request, because it is drawn as one panel and two would show
// half of it before the other arrived.
router.get('/', (req, res) => {
  const profile = db.prepare('SELECT exam_at FROM user_profiles WHERE user_id = ?').get(req.user.id);
  const examAt = profile ? profile.exam_at : null;

  res.json({
    streak: progress.streakFor(req.user.id),
    days: progress.recentDays(req.user.id),
    examAt,
    // null when no date is set, negative once it has passed. The interface
    // decides what to say about each; this only counts.
    examInDays: progress.daysUntil(examAt),
  });
});

module.exports = router;
