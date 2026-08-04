'use strict';

const { getSessionUser, SESSION_COOKIE } = require('../services/auth');

function attachUser(req, res, next) {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  const user = getSessionUser(token);
  req.user = user || null;
  req.sessionToken = user ? token : null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

module.exports = { attachUser, requireAuth };
