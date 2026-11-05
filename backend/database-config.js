const path = require('node:path');
const { readFile } = require('node:fs/promises');
const runtimeConfig = require('./runtime-config.json');
const { getSqlTlsOptions } = require('./sql-tls');

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
          throw Object.assign(new Error('Invalid database settings'), { reason: 'INVALID_SETTINGS' });
        }
        const credentials = JSON.parse(await readCredentials());
        if (!credentials || typeof credentials.user !== 'string' || !credentials.user.trim()
          || typeof credentials.password !== 'string' || !credentials.password) {
          throw Object.assign(new Error('Invalid database credentials'), { reason: 'INVALID_FIELDS' });
        }
        const tlsOptions = await getSqlTlsOptions({
          caFile: settings.caFile, serverName: settings.tlsServerName,
          trustServerCertificate: settings.trustServerCertificate,
        });
        if (tlsOptions.trustServerCertificate) {
          console.warn('[SQL_TLS_UNVERIFIED] A conexão SQL usa criptografia sem validar a identidade do servidor.');
        }
        return {
          server: settings.server.trim(), port: settings.port, database: settings.database,
          user: credentials.user, password: credentials.password,
          options: {
            ...tlsOptions,
            enableArithAbort: true,
          },
          requestTimeout: 60000, connectionTimeout: 30000,
        };
      }).catch(cause => {
        pending = undefined;
        const error = new Error('Não foi possível carregar a configuração segura do banco.');
        error.code = 'SQL_CONFIGURATION_ERROR';
        error.reason = cause.reason || (cause instanceof SyntaxError ? 'INVALID_JSON'
          : cause.code === 'ENOENT' ? 'FILE_NOT_FOUND'
          : cause.code === 'EACCES' || cause.code === 'EPERM' ? 'FILE_PERMISSION' : 'UNKNOWN');
        throw error;
      });
    }
    return pending;
  };
}

const getDatabaseConfig = createDatabaseConfigLoader({
  settings: {
    ...runtimeConfig.sql,
    caFile: process.env.SQL_CA_FILE || runtimeConfig.sql.caFile || '',
    tlsServerName: process.env.SQL_TLS_SERVER_NAME || runtimeConfig.sql.tlsServerName || '',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE
      ?? runtimeConfig.sql.trustServerCertificate ?? false,
  },
  async readCredentials() {
    const filename = getSqlCredentialsPath();
    if (!filename) throw Object.assign(new Error('SQL credentials file not configured'), { reason: 'FILE_NOT_CONFIGURED' });
    return readFile(filename, 'utf8');
  },
});

module.exports = { createDatabaseConfigLoader, getDatabaseConfig, getSqlCredentialsPath };
