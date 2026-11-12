const { getFirebaseAuth } = require('./auth');

async function authorizeHistoryAdmin(auth, email, enabled = true) {
  const user = await auth.getUserByEmail(email.trim());
  if (user.disabled || !user.providerData.some(provider => provider.providerId === 'password')) {
    throw new Error('A conta precisa estar ativa e ter login por e-mail e senha.');
  }
  if (enabled && user.customClaims?.panelAccess !== true) throw new Error('Libere o acesso ao painel primeiro.');
  const claims = { ...user.customClaims };
  if (enabled) claims.historyAdmin = true;
  else delete claims.historyAdmin;
  await auth.setCustomUserClaims(user.uid, claims);
  if (!enabled) await auth.revokeRefreshTokens(user.uid);
  const confirmed = await auth.getUser(user.uid);
  if ((confirmed.customClaims?.historyAdmin === true) !== enabled) throw new Error('Permissão não confirmada.');
  return confirmed.uid;
}

if (require.main === module) {
  const [email, option] = process.argv.slice(2);
  if (!email || (option && option !== '--revoke') || process.argv.length > 4) {
    console.error('Uso: node authorize-history-admin.js email [--revoke]');
    process.exitCode = 1;
  } else {
    Promise.resolve().then(() => authorizeHistoryAdmin(getFirebaseAuth(), email, option !== '--revoke'))
      .then(() => console.log('Permissão de histórico atualizada e confirmada. Saia e entre novamente no site.'))
      .catch(() => { console.error('Não foi possível atualizar a permissão. Verifique a conta e a credencial administrativa.'); process.exitCode = 1; });
  }
}

module.exports = { authorizeHistoryAdmin };
