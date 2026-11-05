const test = require('node:test');
const assert = require('node:assert/strict');
const { getSqlDiagnostic, logSqlError } = require('./sql-diagnostics');

test('identifica certificado TLS mesmo dentro de erros encadeados do driver', () => {
  const error = { code: 'ESOCKET', originalError: { cause: new AggregateError([
    { code: 'DEPTH_ZERO_SELF_SIGNED_CERT', message: 'sensitive-details' },
  ]) } };
  assert.equal(getSqlDiagnostic(error).code, 'SQL_TLS_CERTIFICATE');
});

test('separa falha de login, rede e consulta', () => {
  const cases = [
    [{ code: 'ELOGIN' }, 'SQL_LOGIN_FAILED'],
    [{ code: 'EREQUEST', originalError: { number: 4060 } }, 'SQL_DATABASE_ACCESS'],
    [{ code: 'EREQUEST', number: 229 }, 'SQL_PERMISSION_DENIED'],
    [{ code: 'EREQUEST', precedingErrors: [{ number: 208 }] }, 'SQL_SCHEMA_MISMATCH'],
    [{ code: 'ETIMEOUT' }, 'SQL_TIMEOUT'],
    [{ code: 'ESOCKET' }, 'SQL_NETWORK'],
    [new Error('unknown'), 'SQL_QUERY_FAILED'],
  ];
  for (const [error, expected] of cases) assert.equal(getSqlDiagnostic(error).code, expected);
});

test('o log não inclui senha, endereço, consulta ou mensagem bruta', () => {
  const raw = 'secret-password SELECT sensitive-data FROM private_table 192.0.2.1';
  const lines = [];
  logSqlError({ code: 'ELOGIN', message: raw, originalError: { message: raw } }, line => lines.push(line));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /SQL_LOGIN_FAILED/);
  for (const value of raw.split(' ')) assert.equal(lines[0].includes(value), false);
});

test('classifica arquivo ausente sem imprimir nome ou conteúdo do arquivo', () => {
  const diagnostic = getSqlDiagnostic({
    code: 'SQL_CONFIGURATION_ERROR', reason: 'FILE_NOT_FOUND', message: 'private-file-contents',
  });
  assert.match(diagnostic.message, /não foi encontrado/);
  assert.equal(diagnostic.message.includes('private-file-contents'), false);
});

test('erros cíclicos e mensagens desconhecidas não interrompem o diagnóstico', () => {
  const error = { code: 'ESOCKET' };
  error.cause = error;
  assert.equal(getSqlDiagnostic(error).code, 'SQL_NETWORK');
});
