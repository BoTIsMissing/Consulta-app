const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createDatabaseConfigLoader, getSqlCredentialsPath } = require('./database-config');
const { getGoogleClientOptions } = require('./google-credentials');

const settings = {
  server: '192.0.2.10', port: 1433, database: 'BR',
};

test('usa IP fixo e credenciais do segredo com conexão SQL criptografada', async () => {
  const load = createDatabaseConfigLoader({
    settings,
    async readCredentials() {
      return JSON.stringify({ user: 'reader', password: 'example', server: 'untrusted-host' });
    },
  });
  const config = await load();
  assert.equal(config.server, settings.server);
  assert.equal(config.user, 'reader');
  assert.equal(config.password, 'example');
  assert.equal(config.options.encrypt, true);
  assert.equal(config.options.trustServerCertificate, false);
});

test('compartilha a leitura do segredo entre consultas simultâneas', async () => {
  let reads = 0;
  const load = createDatabaseConfigLoader({
    settings, async readCredentials() { reads++; return '{"user":"reader","password":"example"}'; },
  });
  await Promise.all([load(), load(), load()]);
  assert.equal(reads, 1);
});

test('falhas não expõem detalhes sensíveis e permitem nova tentativa', async () => {
  let reads = 0;
  const load = createDatabaseConfigLoader({
    settings, async readCredentials() {
      if (++reads === 1) throw new Error('private-diagnostic-content');
      return '{"user":"reader","password":"example"}';
    },
  });
  await assert.rejects(load(), error => {
    assert.equal(error.code, 'SQL_CONFIGURATION_ERROR');
    assert.equal(error.message.includes('private-diagnostic-content'), false);
    return true;
  });
  assert.equal((await load()).user, 'reader');
  assert.equal(reads, 2);
});

test('rejeita configurações inválidas antes de ler credenciais', async () => {
  for (const change of [{ server: '' }, { port: 0 }, { port: 70000 }, { database: '' },
    { port: '1433' }, { server: null }]) {
    let read = false;
    const load = createDatabaseConfigLoader({
      settings: { ...settings, ...change }, async readCredentials() { read = true; },
    });
    await assert.rejects(load(), { code: 'SQL_CONFIGURATION_ERROR' });
    assert.equal(read, false);
  }
});

test('rejeita arquivo de credenciais vazio ou malformado', async () => {
  for (const data of ['', 'invalid-json', 'null', '{}', '{"user":"reader","password":""}']) {
    const load = createDatabaseConfigLoader({ settings, async readCredentials() { return data; } });
    await assert.rejects(load(), { code: 'SQL_CONFIGURATION_ERROR' });
  }
});

test('Render usa arquivos secretos e permite caminhos explícitos sem carregar .env', () => {
  const renderEnv = { RENDER: 'true' };
  const config = { firebaseProjectId: 'test-project', googleCredentialsFile: '' };
  const sqlSettings = { credentialsFile: '' };
  assert.equal(getSqlCredentialsPath({ settings: sqlSettings, env: renderEnv }),
    path.resolve('/etc/secrets/sql-credentials.json'));
  assert.equal(getGoogleClientOptions({ config, env: renderEnv }).keyFilename,
    path.resolve('/etc/secrets/service-account.json'));
  assert.equal(getSqlCredentialsPath({ settings: sqlSettings, env: {} }), null);
  assert.equal(getGoogleClientOptions({ config, env: {} }).keyFilename, undefined);
  assert.equal(getSqlCredentialsPath({ settings: sqlSettings, env: {
    ...renderEnv, SQL_CREDENTIALS_FILE: 'private/sql-credentials.json',
  } }), path.resolve(__dirname, 'private/sql-credentials.json'));
  assert.equal(getGoogleClientOptions({ config, env: {
    ...renderEnv, GOOGLE_APPLICATION_CREDENTIALS: 'private/new-service-account.json',
  } }).keyFilename, path.resolve(__dirname, 'private/new-service-account.json'));
});
