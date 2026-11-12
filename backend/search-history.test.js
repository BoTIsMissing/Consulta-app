const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Timestamp } = require('firebase-admin/firestore');
const { createApp } = require('./server');
const { createAuthMiddleware } = require('./auth');
const { createHistoryStore, decodeCursor } = require('./search-history');
const { authorizeHistoryAdmin } = require('./authorize-history-admin');

async function start({ record = async () => {}, list = async () => ({ items: [], nextCursor: null }), getPool } = {}) {
  const records = [];
  const events = [];
  const authenticate = createAuthMiddleware({ async verifyToken(token) {
    if (token === 'invalid') throw new Error('invalid');
    return { uid: token, email: token === 'spoof-email' ? 'bot261446@gmail.com' : 'user@example.test',
      firebase: { sign_in_provider: 'password' }, panelAccess: token !== 'unapproved',
      historyAdmin: token === 'admin' ? true : token === 'string-claim' ? 'true' : false };
  } });
  const app = createApp({ authenticate, origins: ['https://botismissing.github.io'],
    rateLimits: { ipLimit: 1000, userLimit: 1000 },
    history: { enabled: true, async record(event) { records.push(event); events.push('record'); await record(event); }, list },
    getPool: getPool || (async () => {
      events.push('database');
      return { request: () => ({ input() { return this; }, async query() { return { recordset: [] }; } }) };
    }),
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    records, events,
    request(route, body, token = 'approved', method = 'POST') {
      return fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

test('todas as buscas registram usuário e termo normalizado antes do SQL, inclusive chamadas diretas', async () => {
  const app = await start();
  try {
    const cases = [
      ['/buscar-nome', { termo: 'teste' }, 'nome', 'TESTE'],
      ['/buscar-nome', { termo: 'j. teste', parcial: true }, 'nome_parcial', 'J. TESTE'],
      ['/buscar-cpf', { termo: '000.000.000-00' }, 'cpf', '00000000000'],
      ['/buscar-cnpj', { termo: '00.000.000/0000-00' }, 'cnpj', '00000000000000'],
      ['/buscar-placa', { termo: 'abc-1234' }, 'placa', 'ABC1234'],
      ['/buscar-id', { id: '9007199254740993' }, 'id', '9007199254740993'],
      ['/buscar-endereco', { termo: 'rua teste' }, 'endereco', 'RUA TESTE'],
    ];
    for (const [route, body, type, term] of cases) {
      app.events.length = 0;
      assert.equal((await app.request(route, body)).status, 200);
      assert.deepEqual(app.records.at(-1), { uid: 'approved', email: 'user@example.test', type, term });
      assert.deepEqual(app.events, ['record', 'database']);
    }
    assert.equal(app.records.length, cases.length);
  } finally { await app.close(); }
});

test('sem acesso, entrada inválida e identidade forjada não criam registros nem chegam ao SQL', async () => {
  const app = await start();
  try {
    for (const [token, status] of [['invalid', 401], ['unapproved', 403]]) {
      assert.equal((await app.request('/buscar-cpf', { termo: '00000000000' }, token)).status, status);
    }
    for (const body of [{ termo: '123' }, { termo: '00000000000', uid: 'other-user' }, { termo: '00000000000', email: 'other@example.test' }]) {
      assert.equal((await app.request('/buscar-cpf', body)).status, 400);
    }
    assert.equal((await app.request('/buscar-cpf', undefined, 'approved', 'GET')).status, 405);
    assert.deepEqual(app.records, []);
    assert.deepEqual(app.events, []);
  } finally { await app.close(); }
});

test('falha no registro bloqueia o SQL e não expõe o erro interno do armazenamento', async () => {
  const app = await start({ record: async () => { throw new Error('private-service-detail'); } });
  try {
    const response = await app.request('/buscar-cpf', { termo: '00000000000' });
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private-service-detail/);
    assert.deepEqual(app.events, ['record']);
  } finally { await app.close(); }
});

test('histórico representa a solicitação mesmo quando o SQL falha', async () => {
  const app = await start({ getPool: async () => { throw new Error('simulated SQL failure'); } });
  try {
    assert.equal((await app.request('/buscar-cpf', { termo: '00000000000' })).status, 500);
    assert.equal(app.records.length, 1);
  } finally { await app.close(); }
});

test('somente claim administrativa booleana permite ler o histórico, sem confiar no e-mail', async () => {
  let reads = 0;
  const app = await start({ list: async cursor => { reads++; assert.equal(cursor, null); return { items: [], nextCursor: null }; } });
  try {
    for (const token of ['approved', 'spoof-email', 'string-claim']) {
      assert.equal((await app.request('/admin/history', { cursor: null }, token)).status, 403);
    }
    assert.equal(reads, 0);
    const response = await app.request('/admin/history', { cursor: null }, 'admin');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.deepEqual(await response.json(), { items: [], nextCursor: null });
    assert.equal(reads, 1);
    assert.deepEqual(app.records, []);
    assert.deepEqual(app.events, []);
  } finally { await app.close(); }
});

test('sessão informa permissão de histórico validada no servidor', async () => {
  const app = await start();
  try {
    for (const token of ['admin', 'spoof-email', 'approved']) {
      const response = await app.request('/auth/session', undefined, token, 'GET');
      const body = await response.json();
      assert.equal(body.historyAdmin, token === 'admin');
      assert.equal(body.historyEnabled, true);
    }
  } finally { await app.close(); }
});

test('desativado, o histórico não inicializa Firestore e retorna indisponibilidade explícita na leitura', async () => {
  const store = createHistoryStore({ enabled: false, getDb() { assert.fail('Não deve inicializar Firestore'); } });
  await store.record({ uid: 'user', email: 'user@example.test', type: 'cpf', term: '00000000000' });
  await assert.rejects(store.list(null), { code: 'HISTORY_DISABLED' });
});

test('gravação escolhe apenas campos previstos e usa o horário do servidor', async () => {
  const now = Timestamp.fromMillis(1700000000000);
  let saved;
  const store = createHistoryStore({ enabled: true, now: () => now, getDb: () => ({
    collection(name) { assert.equal(name, 'searchHistory'); return { doc: () => ({ create: async data => { saved = data; } }) }; },
  }) });
  await store.record({ uid: 'user', email: 'user@example.test', type: 'cpf', term: '00000000000', token: 'not-stored', password: 'not-stored' });
  assert.deepEqual(saved, { uid: 'user', email: 'user@example.test', type: 'cpf', term: '00000000000', at: now });
});

test('paginação usa data e ID para desempatar e lê no máximo 51 documentos', async () => {
  const at = Timestamp.fromMillis(1700000000000);
  const docs = Array.from({ length: 51 }, (_, index) => ({ id: `entry${index}`, data: () => ({ uid: 'user', email: 'user@example.test', type: 'cpf', term: '00000000000', at }) }));
  let resumed;
  const query = {
    orderBy() { return this; }, startAfter(...args) { resumed = args; return this; },
    limit(value) { assert.equal(value, 51); return this; }, async get() { return { docs }; },
  };
  const store = createHistoryStore({ enabled: true, getDb: () => ({ collection: () => query }) });
  const first = await store.list(null);
  assert.equal(first.items.length, 50);
  assert.deepEqual(decodeCursor(first.nextCursor), { at: at.toMillis(), id: 'entry49' });
  await store.list(first.nextCursor);
  assert.equal(resumed[0].toMillis(), at.toMillis());
  assert.equal(resumed[1], 'entry49');
  docs.length = 1;
  assert.equal((await store.list(null)).nextCursor, null);
});

test('cursor malformado é rejeitado sem acessar Firestore', async () => {
  const store = createHistoryStore({ enabled: true, getDb() { assert.fail('Não deve consultar Firestore'); } });
  for (const cursor of [{}, 'a'.repeat(513), 'not-json', Buffer.from(JSON.stringify({ at: 1, id: '../../other' })).toString('base64url')]) {
    await assert.rejects(store.list(cursor), { code: 'INVALID_INPUT' });
  }
  const app = await start({ list: cursor => store.list(cursor) });
  try { assert.equal((await app.request('/admin/history', { cursor: {} }, 'admin')).status, 400); }
  finally { await app.close(); }
});

test('liberação administrativa preserva outras claims e revogação invalida sessões existentes', async () => {
  let claims = { panelAccess: true, anotherPermission: true };
  let revoked = false;
  const auth = {
    async getUserByEmail() { return { uid: 'admin-user', providerData: [{ providerId: 'password' }], customClaims: claims, disabled: false }; },
    async setCustomUserClaims(uid, value) { assert.equal(uid, 'admin-user'); claims = value; },
    async getUser() { return { customClaims: claims }; },
    async revokeRefreshTokens(uid) { assert.equal(uid, 'admin-user'); revoked = true; },
  };
  await authorizeHistoryAdmin(auth, 'admin@example.test');
  assert.deepEqual(claims, { panelAccess: true, anotherPermission: true, historyAdmin: true });
  await authorizeHistoryAdmin(auth, 'admin@example.test', false);
  assert.deepEqual(claims, { panelAccess: true, anotherPermission: true });
  assert.equal(revoked, true);
});

test('contas inativas, sem senha ou sem acesso ao painel não recebem permissão administrativa', async () => {
  for (const user of [
    { disabled: true, providerData: [{ providerId: 'password' }], customClaims: { panelAccess: true } },
    { disabled: false, providerData: [{ providerId: 'google.com' }], customClaims: { panelAccess: true } },
    { disabled: false, providerData: [{ providerId: 'password' }], customClaims: {} },
  ]) {
    await assert.rejects(authorizeHistoryAdmin({
      async getUserByEmail() { return user; },
      async setCustomUserClaims() { assert.fail('Não deve conceder a permissão'); },
    }, 'user@example.test'));
  }
});
