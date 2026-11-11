const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('./server');
const { createAuthMiddleware } = require('./auth');

const origin = 'https://botismissing.github.io';
async function start({ recordset = [], respond, ...options } = {}) {
  const inputs = [];
  const queries = [];
  let databaseCalls = 0;
  const pool = {
    request() {
      return {
        input(key, type, value) { inputs.push({ key, value }); return this; },
        async query(query) {
          queries.push(query);
          return { recordset: respond ? respond(query)
            : /FROM BR\.\.(company|c_cnes)\b/.test(query) ? [] : recordset };
        },
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

test('placa exige conta liberada e POST, sem consultar o banco antes da autorização', async () => {
  const app = await start();
  try {
    for (const [token, status] of [['invalid', 401], ['unapproved', 403]]) {
      assert.equal((await app.request('/api/buscar-placa', { termo: 'ABC1D23' }, { token })).status, status);
    }
    assert.equal((await app.request('/api/buscar-placa', undefined, { method: 'GET' })).status, 405);
    assert.equal(app.databaseCalls(), 0);
  } finally { await app.close(); }
});

test('placa inválida não chega ao SQL, incluindo tentativas de injeção e curingas', async () => {
  const app = await start();
  try {
    for (const termo of [undefined, null, 1234567, {}, 'ABC', 'ABC12345', 'ABC-DEFG', 'ABC%123', "ABC1234' OR 1=1--", 'ABC1234\nXYZ']) {
      assert.equal((await app.request('/api/buscar-placa', { termo })).status, 400);
    }
    assert.equal((await app.request('/api/buscar-placa', { termo: 'ABC1234', extra: true })).status, 400);
    assert.equal(app.databaseCalls(), 0);
  } finally { await app.close(); }
});

test('placas antigas e Mercosul são normalizadas e consultadas por igualdade com parâmetros', async () => {
  const app = await start();
  try {
    for (const [termo, normalized] of [[' abc-1234 ', 'ABC1234'], ['abc1234', 'ABC1234'], ['abc1d23', 'ABC1D23'], ['ABC-1D23', 'ABC1D23']]) {
      const response = await app.request('/api/buscar-placa', { termo });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { total: 0, veiculos: [] });
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.deepEqual(app.inputs.slice(-2), [
        { key: 'plate', value: normalized },
        { key: 'formattedPlate', value: `${normalized.slice(0, 3)}-${normalized.slice(3)}` },
      ]);
      assert.match(app.queries.at(-1), /WHERE d\.plate IN \(@plate, @formattedPlate\)/);
      assert.equal(app.queries.at(-1).includes(normalized), false);
    }
  } finally { await app.close(); }
});

test('veículos são retornados sem descartar nacionalidade desconhecida ou inventar grupo', async () => {
  const recordset = [{ id: '9007199254740993', plate: 'ABC1D23', nationality_code: 99, nationality_description: null }];
  const app = await start({ recordset });
  try {
    const response = await app.request('/api/buscar-placa', { termo: 'ABC1D23' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { total: 1, veiculos: recordset });
    assert.match(app.queries[0], /LEFT JOIN BR_VEICULOS\.\.nacionalidade/);
    assert.doesNotMatch(app.queries[0], /br_group_vehicles/);
  } finally { await app.close(); }
});

test('CNPJ exige autorização e rejeita entradas inválidas antes de chegar ao SQL', async () => {
  const app = await start();
  try {
    for (const [token, status] of [['invalid', 401], ['unapproved', 403]]) {
      assert.equal((await app.request('/api/buscar-cnpj', { termo: '00000000000000' }, { token })).status, status);
    }
    assert.equal((await app.request('/api/buscar-cnpj', undefined, { method: 'GET' })).status, 405);
    for (const termo of [undefined, null, {}, 12345678901234, '12345678901', '1'.repeat(15), 'A'.repeat(14), "00' OR 1=1--", '%'.repeat(14), '1'.repeat(33)]) {
      assert.equal((await app.request('/api/buscar-cnpj', { termo })).status, 400);
    }
    assert.equal((await app.request('/api/buscar-cnpj', { termo: '00000000000000', extra: true })).status, 400);
    assert.equal(app.databaseCalls(), 0);
  } finally { await app.close(); }
});

test('CNPJ com e sem máscara preserva zeros e pesquisa ambos os campos por parâmetros', async () => {
  const app = await start();
  try {
    for (const termo of ['00123456000100', '00.123.456/0001-00', ' 00.123.456/0001-00 ']) {
      const response = await app.request('/api/buscar-cnpj', { termo });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { total: 0, candidatos: [], empresa: null });
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.deepEqual(app.inputs.slice(-2), [
        { key: 'cnpj', value: '00123456000100' },
        { key: 'formattedCnpj', value: '00.123.456/0001-00' },
      ]);
      const query = app.queries.find(query => query.includes('pep.cnpj'));
      assert.match(query, /EXISTS/);
      assert.match(query, /pep.id = p.id/);
      assert.match(query, /pep.cnpj IN \(@cnpj, @formattedCnpj\)/);
      assert.match(query, /pep.cnpj_relacionamento IN \(@cnpj, @formattedCnpj\)/);
      assert.equal(query.includes('00123456000100'), false);
    }
  } finally { await app.close(); }
});

test('busca por CNPJ retorna candidatos com identificadores textuais', async () => {
  const candidatos = [{ id: '9007199254740993', cpf: '00000000000', name: 'PESSOA DE TESTE', birth_date: '', genre: '' }];
  const app = await start({ recordset: candidatos });
  try {
    const response = await app.request('/api/buscar-cnpj', { termo: '00000000000000' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { total: 1, candidatos, empresa: null });
  } finally { await app.close(); }
});

test('busca por CNPJ retorna empresa e CNES mesmo sem pessoas em PEP', async () => {
  const company = [{ id: '9007199254740993', cnpj: '00000000000000', name1: 'EMPRESA FICTICIA' }];
  const cnes = [{ cnpj: '00000000000000', cnes: '0000000' }];
  const app = await start({ respond: query => query.includes('FROM BR..company') ? company
    : query.includes('FROM BR..c_cnes') ? cnes : [] });
  try {
    const response = await app.request('/api/buscar-cnpj', { termo: '00000000000000' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.total, 0);
    assert.deepEqual(result.candidatos, []);
    assert.deepEqual(result.empresa.company, company);
    assert.deepEqual(result.empresa.cnes, cnes);
    assert.equal(app.inputs.filter(input => input.key === 'companyId0').every(input => input.value === company[0].id), true);
    assert.equal(app.queries.length, 11);
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

test('detalhes da pessoa incluem PEP por ID parametrizado e preservam CNPJ textual', async () => {
  const pep = [{ cnpj: '00000000000000', cnpj_relacionamento: null, dt_inicio: '2020-01-01', dt_carencia: null, descricao_profissao: 'DESCRICAO DE TESTE' }];
  const queries = [];
  const id = '9007199254740993';
  const app = await start({ getPool: async () => ({ request: () => ({
    input(key, type, value) { assert.equal(key, 'id'); assert.equal(value, id); return this; },
    async query(query) {
      queries.push(query);
      return { recordset: query.includes('BR..p_pep') ? pep : query.includes('people      WHERE') ? [{ id }] : [] };
    },
  }) }) });
  try {
    const response = await app.request('/api/buscar-id', { id });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.encontrado, true);
    assert.deepEqual(result.dados.pep, pep);
    assert.match(queries.find(query => query.includes('BR..p_pep')), /WHERE id = @id/);
    assert.equal(queries.length, 9);
  } finally { await app.close(); }
});

test('pessoa sem registros PEP mantém as demais seções disponíveis', async () => {
  const app = await start({ getPool: async () => ({ request: () => ({
    input() { return this; },
    async query(query) { return { recordset: query.includes('people      WHERE') ? [{ id: '1' }] : [] }; },
  }) }) });
  try {
    const response = await app.request('/api/buscar-id', { id: '1' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.encontrado, true);
    assert.deepEqual(result.dados.pep, []);
    assert.deepEqual(result.dados.people, [{ id: '1' }]);
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
      if (++count === 9) started();
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
