const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('./server');
const { createAuthMiddleware } = require('./auth');

const origin = 'https://botismissing.github.io';
async function start(options = {}) {
  const inputs = [];
  const queries = [];
  let databaseCalls = 0;
  const pool = {
    request() {
      return {
        input(key, type, value) { inputs.push({ key, value }); return this; },
        async query(query) { queries.push(query); return { recordset: [] }; },
      };
    },
    async close() { assert.fail('Uma requisição não deve fechar o pool compartilhado'); },
  };
  const authenticate = createAuthMiddleware({ async verifyToken(token) {
    if (token === 'invalid') throw new Error('invalid');
    return { uid: token, email: 'test@example.com', firebase: { sign_in_provider: 'password' }, panelAccess: token !== 'unapproved' };
  } });
  const app = createApp({
    origins: [origin], authenticate,
    getPool: async () => { databaseCalls++; return pool; },
    rateLimits: { ipLimit: 1000, userLimit: 1000 }, ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url, inputs, queries, databaseCalls: () => databaseCalls,
    request(route, body, { token = 'approved', headers = {}, method = 'POST' } = {}) {
      return fetch(url + route, {
        method, headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
    },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

test('requisições sem autorização ou de outra origem não chegam ao banco', async () => {
  const app = await start();
  try {
    for (const token of ['invalid', 'unapproved']) {
      const response = await app.request('/api/buscar-nome', { termo: 'TESTE' }, { token });
      assert.equal(response.status, token === 'invalid' ? 401 : 403);
    }
    const response = await app.request('/api/buscar-nome', { termo: 'TESTE' }, { headers: { Origin: 'https://attacker.example' } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(app.databaseCalls(), 0);
  } finally { await app.close(); }
});

test('GET com identificador pessoal é recusado e respostas não são armazenáveis', async () => {
  const app = await start();
  try {
    const response = await app.request('/api/buscar-cpf?termo=01234567890', undefined, { method: 'GET' });
    assert.equal(response.status, 405);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(app.databaseCalls(), 0);
  } finally { await app.close(); }
});

test('JSON inválido, corpos grandes e formatos inesperados não chegam ao banco', async () => {
  const app = await start();
  try {
    const cases = [
      ['{"termo":"private-value"', {}, 400],
      [{ termo: 'A'.repeat(5000) }, {}, 413],
      [{ termo: 'TESTE' }, { 'Content-Type': 'text/plain' }, 415],
      [[], {}, 400],
      [{ termo: { value: 'TESTE' } }, {}, 400],
      [{ termo: 'A'.repeat(151) }, {}, 400],
      [{ termo: 'TESTE', parcial: 'true' }, {}, 400],
      [{ termo: 'TESTE', unexpected: true }, {}, 400],
    ];
    for (const [body, headers, expected] of cases) {
      const response = await app.request('/api/buscar-nome', body, { headers });
      assert.equal(response.status, expected);
      assert.equal((await response.text()).includes('private-value'), false);
    }
    assert.equal(app.databaseCalls(), 0);
  } finally { await app.close(); }
});

test('valida CPF e ID e preserva CPF com zeros na consulta parametrizada', async () => {
  const app = await start();
  try {
    assert.equal((await app.request('/api/buscar-cpf', { termo: '123' })).status, 400);
    assert.equal((await app.request('/api/buscar-id', { id: '9'.repeat(1000) })).status, 400);
    assert.equal((await app.request('/api/buscar-id', { id: { value: 1 } })).status, 400);
    assert.equal(app.databaseCalls(), 0);
    const response = await app.request('/api/buscar-cpf', { termo: '012.345.678-90' });
    assert.equal(response.status, 200);
    assert.deepEqual(app.inputs.at(-1), { key: 'cpf', value: '01234567890' });
  } finally { await app.close(); }
});

test('entrada SQL é tratada como parâmetro e curingas de endereço são literais', async () => {
  const app = await start();
  try {
    const value = "TESTE' OR 1=1--";
    assert.equal((await app.request('/api/buscar-nome', { termo: value })).status, 200);
    assert.equal(app.inputs.at(-1).value, value);
    assert.equal(app.queries.at(-1).includes(value), false);
    assert.equal((await app.request('/api/buscar-endereco', { termo: '%_' })).status, 200);
    assert.equal(app.inputs.at(-1).value, '%[%][_]%');
  } finally { await app.close(); }
});

test('limite por conta não é contornado mudando o IP informado pelo cliente', async () => {
  const app = await start({ trustProxy: 1, rateLimits: { ipLimit: 1000, userLimit: 2 } });
  try {
    for (let index = 0; index < 3; index++) {
      const response = await app.request('/api/buscar-nome', { termo: 'TESTE' },
        { headers: { 'X-Forwarded-For': `192.0.2.${index + 1}` } });
      assert.equal(response.status, index === 2 ? 429 : 200);
    }
    assert.equal(app.databaseCalls(), 2);
    assert.equal((await app.request('/api/buscar-nome', { termo: 'TESTE' }, { token: 'another-approved-user' })).status, 200);
  } finally { await app.close(); }
});

test('excesso de tokens inválidos é bloqueado antes de acessar o banco', async () => {
  const app = await start({ rateLimits: { ipLimit: 2, userLimit: 100 } });
  try {
    for (let index = 0; index < 3; index++) {
      const response = await app.request('/api/buscar-nome', { termo: 'TESTE' }, { token: 'invalid' });
      assert.equal(response.status, index === 2 ? 429 : 401);
    }
    assert.equal(app.databaseCalls(), 0);
  } finally { await app.close(); }
});

test('falha em uma seção mantém o limite ocupado até terminarem as demais consultas', async () => {
  let count = 0;
  let finish;
  let started;
  const allStarted = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { finish = resolve; });
  const app = await start({ queryLimits: { userLimit: 1 }, getPool: async () => ({ request: () => ({
    input() { return this; },
    async query(query) {
      if (++count === 8) started();
      if (query.includes('people      WHERE')) throw new Error('simulated query error');
      await pending;
      return { recordset: [] };
    },
  }) }) });
  try {
    const details = app.request('/api/buscar-id', { id: '1' });
    await allStarted;
    assert.equal((await app.request('/api/buscar-nome', { termo: 'TESTE' })).status, 429);
    finish();
    assert.equal((await details).status, 500);
  } finally { finish(); await app.close(); }
});

test('limite de consultas simultâneas é liberado quando as consultas terminam', async () => {
  let complete;
  let started;
  const bothStarted = new Promise(resolve => { started = resolve; });
  const finish = new Promise(resolve => { complete = resolve; });
  let count = 0;
  const app = await start({ getPool: async () => ({ request: () => ({
    input() { return this; }, async query() { if (++count === 2) started(); await finish; return { recordset: [] }; },
  }) }) });
  try {
    const first = app.request('/api/buscar-nome', { termo: 'TESTE' });
    const second = app.request('/api/buscar-nome', { termo: 'TESTE' });
    await bothStarted;
    assert.equal((await app.request('/api/buscar-nome', { termo: 'TESTE' })).status, 429);
    complete();
    for (const response of await Promise.all([first, second])) assert.equal(response.status, 200);
    assert.equal((await app.request('/api/buscar-nome', { termo: 'TESTE' })).status, 200);
  } finally { complete(); await app.close(); }
});

test('erros do SQL não expõem detalhes internos na resposta HTTP', async () => {
  const secret = 'do-not-expose-this-password';
  const app = await start({ getPool: async () => { throw Object.assign(new Error(secret), { code: 'ELOGIN' }); } });
  try {
    const response = await app.request('/api/buscar-nome', { termo: 'TESTE' });
    assert.equal(response.status, 500);
    assert.equal((await response.text()).includes(secret), false);
  } finally { await app.close(); }
});

test('arquivos internos e credenciais não são servidos pela API', async () => {
  const app = await start();
  try {
    for (const route of ['/.env', '/backend/service-account.json', '/fr-base.json', '/backend/runtime-config.json', '/liberar-acesso.bat']) {
      assert.equal((await fetch(app.url + route)).status, 404);
    }
  } finally { await app.close(); }
});
