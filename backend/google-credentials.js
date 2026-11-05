const path = require('node:path');
const { readFileSync } = require('node:fs');
const { applicationDefault, cert } = require('firebase-admin/app');
const runtimeConfig = require('./runtime-config.json');

function getGoogleClientOptions({ config = runtimeConfig, env = process.env } = {}) {
  const options = { projectId: config.firebaseProjectId };
  const filename = env.GOOGLE_APPLICATION_CREDENTIALS || config.googleCredentialsFile
    || (env.RENDER === 'true' ? '/etc/secrets/service-account.json' : '');
  if (filename) {
    options.keyFilename = path.resolve(__dirname, filename);
  }
  return options;
}

function getFirebaseCredential() {
  const options = getGoogleClientOptions();
  try {
    return options.keyFilename
      ? cert(JSON.parse(readFileSync(options.keyFilename, 'utf8')))
      : applicationDefault();
  } catch {
    const error = new Error('Credenciais administrativas do Firebase não configuradas.');
    error.code = 'auth/not-configured';
    throw error;
  }
}

module.exports = { getGoogleClientOptions, getFirebaseCredential };
