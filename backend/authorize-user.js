const { getFirebaseAuth } = require('./auth');

// Execute somente no ambiente do administrador, com as credenciais do Admin SDK.
async function authorizeUser(auth, email) {
  const user = await auth.getUserByEmail(email.trim());
  if (user.disabled || !user.providerData.some(provider => provider.providerId === 'password')) {
    throw new Error('A conta precisa estar ativa e ter login por e-mail e senha.');
  }
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, panelAccess: true });
}

if (require.main === module) {
  const email = process.argv[2];
  if (!email || process.argv.length !== 3) {
    console.error('Uso: npm.cmd run authorize -- usuario@exemplo.com');
    process.exitCode = 1;
  } else {
    Promise.resolve().then(() => authorizeUser(getFirebaseAuth(), email)).then(() => {
      console.log('Acesso liberado. O usuário já pode entrar com e-mail e senha. Se estava conectado, deve sair e entrar novamente.');
    }).catch(error => {
      console.error('Não foi possível liberar a conta:', error.message);
      process.exitCode = 1;
    });
  }
}

module.exports = { authorizeUser };
