const test = require('node:test');
const assert = require('node:assert/strict');
const { rootCertificates } = require('node:tls');
const { getSqlTlsOptions } = require('./sql-tls');

test('sem certificado adicional, mantém criptografia e validação padrão', async () => {
  let read = false;
  const options = await getSqlTlsOptions({ async readCertificate() { read = true; } });
  assert.equal(options.encrypt, true);
  assert.equal(options.trustServerCertificate, false);
  assert.equal(read, false);
});

test('aceita certificado público e nome TLS sem desativar a validação', async () => {
  const options = await getSqlTlsOptions({
    caFile: 'sql-ca.pem', serverName: 'sql.example.com',
    async readCertificate() { return rootCertificates[0]; },
  });
  assert.equal(options.serverName, 'sql.example.com');
  assert.equal(options.trustServerCertificate, false);
  assert.deepEqual(options.cryptoCredentialsDetails.ca, [rootCertificates[0]]);
});

test('arquivo inválido ou contendo chave privada não é aceito como certificado SQL', async () => {
  for (const contents of ['invalid', rootCertificates[0] + '\n-----BEGIN PRIVATE KEY-----\nprivate-content']) {
    await assert.rejects(() => getSqlTlsOptions({ caFile: 'sql-ca.pem', async readCertificate() { return contents; } }),
      { reason: 'INVALID_CA_CERTIFICATE' });
  }
});

test('certificado ausente não faz a conexão aceitar certificados desconhecidos', async () => {
  await assert.rejects(() => getSqlTlsOptions({
    caFile: 'sql-ca.pem', async readCertificate() { throw Object.assign(new Error(), { code: 'ENOENT' }); },
  }), { reason: 'CA_FILE_NOT_FOUND' });
});

test('nome TLS inválido é rejeitado antes da leitura do arquivo', async () => {
  await assert.rejects(() => getSqlTlsOptions({ serverName: 'sql.example.com\nother-host' }),
    { reason: 'INVALID_TLS_SETTINGS' });
});

test('aceitar certificado autoassinado exige configuração explícita e mantém criptografia', async () => {
  for (const value of [true, 'true', ' TRUE ']) {
    let read = false;
    const options = await getSqlTlsOptions({
      trustServerCertificate: value, caFile: 'unavailable.pem',
      async readCertificate() { read = true; throw new Error(); },
    });
    assert.equal(options.encrypt, true);
    assert.equal(options.trustServerCertificate, true);
    assert.equal(read, false);
  }
});

test('false como texto não desativa a validação de certificados', async () => {
  for (const value of [false, 'false', ' FALSE ']) {
    const options = await getSqlTlsOptions({ trustServerCertificate: value });
    assert.equal(options.trustServerCertificate, false);
    assert.equal(options.encrypt, true);
  }
});

test('valor desconhecido não habilita a aceitação de certificados sem validação', async () => {
  for (const value of ['yes', '1', '', 1, null]) {
    await assert.rejects(() => getSqlTlsOptions({ trustServerCertificate: value }),
      { reason: 'INVALID_TLS_SETTINGS' });
  }
});
