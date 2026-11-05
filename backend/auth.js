const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const runtimeConfig = require('./runtime-config.json');
const { getFirebaseCredential } = require('./google-credentials');

function createAuthMiddleware({ verifyToken }) {
  return async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
    let user;
    try {
      user = await verifyToken(match[1]);
    } catch (error) {
      if (error.code === 'auth/not-configured') {
        return res.status(503).json({ erro: 'Autenticação ainda não configurada no servidor.' });
      }
      return res.status(401).json({ erro: 'Sessão inválida ou expirada. Entre novamente.' });
    }
    if (!user || typeof user.uid !== 'string' || !user.uid || user.uid.length > 128
      || !user.email || user.firebase?.sign_in_provider !== 'password') {
      return res.status(403).json({ erro: 'Entre com o e-mail e a senha fornecidos pelo administrador.' });
    }
    if (user.panelAccess !== true) {
      return res.status(403).json({ erro: 'Esta conta ainda não foi liberada pelo administrador.' });
    }
    req.user = user;
    return next();
  };
}

function getFirebaseAuth() {
  if (!runtimeConfig.firebaseProjectId) {
    const error = new Error('Firebase project not configured');
    error.code = 'auth/not-configured';
    throw error;
  }
  const firebaseApp = getApps()[0] || initializeApp({
    credential: getFirebaseCredential(),
    projectId: runtimeConfig.firebaseProjectId,
  });
  return getAuth(firebaseApp);
}

async function verifyToken(token) {
  return getFirebaseAuth().verifyIdToken(token, true);
}

const requireAuth = createAuthMiddleware({ verifyToken });

module.exports = { createAuthMiddleware, requireAuth, getFirebaseAuth };
