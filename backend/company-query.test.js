const test = require('node:test');
const assert = require('node:assert/strict');
const { buscarEmpresa, settledResults } = require('./company-query');

function fakePool(company, cnes = []) {
  const calls = [];
  return { calls, request() {
    const inputs = {};
    return {
      input(key, type, value) { inputs[key] = value; return this; },
      async query(query) {
        calls.push({ query, inputs });
        return { recordset: query.includes('FROM BR..company') ? company
          : query.includes('FROM BR..c_cnes') ? cnes : [] };
      },
    };
  } };
}

test('empresa ausente não consulta detalhes nem usa cnpj8 como alternativa', async () => {
  const pool = fakePool([]);
  assert.equal(await buscarEmpresa(pool, '00123456000100', '00.123.456/0001-00'), null);
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0].query, /WHERE cnpj IN \(@cnpj, @formattedCnpj\)/);
  assert.doesNotMatch(pool.calls[0].query, /WHERE cnpj8/);
  assert.deepEqual(pool.calls[0].inputs, { cnpj: '00123456000100', formattedCnpj: '00.123.456/0001-00' });
});

test('CNES isolado é preservado sem inventar dados cadastrais da empresa', async () => {
  const cnes = [{ cnpj: '00123456000100', cnes: '0000001' }];
  const pool = fakePool([], cnes);
  const data = await buscarEmpresa(pool, '00123456000100', '00.123.456/0001-00');
  assert.deepEqual(data.company, []);
  assert.deepEqual(data.cnes, cnes);
  assert.deepEqual(data.company_partners, []);
  assert.equal(pool.calls.length, 2);
});

test('detalhes usam os IDs de company como BigInt textual, preservando todos os cadastros encontrados', async () => {
  const companies = [{ id: '9007199254740993' }, { id: '9007199254740994' }];
  const pool = fakePool(companies);
  const data = await buscarEmpresa(pool, '00123456000100', '00.123.456/0001-00');
  assert.deepEqual(data.company, companies);
  assert.equal(pool.calls.length, 10);
  for (const call of pool.calls.slice(2)) {
    assert.deepEqual(call.inputs, { companyId0: companies[0].id, companyId1: companies[1].id });
    assert.match(call.query, /WHERE id IN \(@companyId0,@companyId1\)/);
    assert.doesNotMatch(call.query, /9007199254740993|\$IDS/);
  }
});

test('uma falha aguarda as outras consultas antes de liberar o limite de concorrência', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  let completed = false;
  const result = settledResults([Promise.reject(new Error('consulta falhou')), pending]);
  const handled = result.catch(error => { completed = true; return error; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  finish({ recordset: [] });
  assert.equal((await handled).message, 'consulta falhou');
});
