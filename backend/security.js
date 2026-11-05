const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

function securityHeaders() {
  return helmet({ frameguard: { action: 'deny' } });
}

function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  next();
}

function createRequestLimits({ ipLimit = 120, userLimit = 30, windowMs = 60000 } = {}) {
  const shared = {
    windowMs, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { erro: 'Muitas solicitações. Aguarde um minuto e tente novamente.' },
  };
  return {
    beforeAuth: rateLimit({ ...shared, limit: ipLimit }),
    afterAuth: rateLimit({ ...shared, limit: userLimit, keyGenerator: req => `user:${req.user.uid}` }),
  };
}

function createQueryGate({ globalLimit = 5, userLimit = 2 } = {}) {
  let active = 0;
  const byUser = new Map();
  return handler => async (req, res, next) => {
    const uid = req.user.uid;
    const count = byUser.get(uid) || 0;
    if (active >= globalLimit || count >= userLimit) {
      res.setHeader('Retry-After', '5');
      return res.status(429).json({ erro: 'Há consultas em andamento. Aguarde antes de consultar novamente.' });
    }
    active++;
    byUser.set(uid, count + 1);
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    } finally {
      active--;
      const remaining = byUser.get(uid) - 1;
      if (remaining) byUser.set(uid, remaining);
      else byUser.delete(uid);
    }
  };
}

module.exports = { securityHeaders, noStore, createRequestLimits, createQueryGate };
