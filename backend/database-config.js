const path = require('node:path');
const { readFile } = require('node:fs/promises');
const runtimeConfig = require('./runtime-config.json');

function getSqlCredentialsPath({ settings = runtimeConfig.sql, env = process.env } = {}) {
  const filename = env.SQL_CREDENTIALS_FILE || settings.credentialsFile
    || (env.RENDER === 'true' ? '/etc/secrets/sql-credentials.json' : '');
  return filename ? path.resolve(__dirname, filename) : null;
}

function createDatabaseConfigLoader({ settings, readCredentials }) {
  let pending;
  return function getDatabaseConfig() {
    if (!pending) {
      pending = Promise.resolve().then(async () => {
        if (typeof settings.server !== 'string' || !settings.server.trim()
          || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535
          || typeof settings.database !== 'string' || !settings.database.trim()) {
          throw new Error('Invalid database settings');
        }
        const credentials = JSON.parse(await readCredentials());
        if (!credentials || typeof credentials.user !== 'string' || !credentials.user.trim()
          || typeof credentials.password !== 'string' || !credentials.password) {
          throw new Error('Invalid database credentials');
        }
        return {
          server: settings.server.trim(), port: settings.port, database: settings.database,
          user: credentials.user, password: credentials.password,
          options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
          requestTimeout: 60000, connectionTimeout: 30000,
        };
      }).catch(() => {
        pending = undefined;
        const error = new Error('Não foi possível carregar a configuração segura do banco.');
        error.code = 'SQL_CONFIGURATION_ERROR';
        throw error;
      });
    }
    return pending;
  };
}

const getDatabaseConfig = createDatabaseConfigLoader({
  settings: runtimeConfig.sql,
  async readCredentials() {
    const filename = getSqlCredentialsPath();
    if (!filename) throw new Error('SQL credentials file not configured');
    return readFile(filename, 'utf8');
  },
});

module.exports = { createDatabaseConfigLoader, getDatabaseConfig, getSqlCredentialsPath };
