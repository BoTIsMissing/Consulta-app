const test = require('node:test');
const assert = require('node:assert/strict');
const { nameSearch } = require('./input-validation');

test('nome parcial começa pelo primeiro trecho e permite omitir sobrenomes intermediários', () => {
  assert.equal(nameSearch('joão silva', true), 'JOÃO%SILVA%');
  assert.equal(nameSearch('silva', true), 'SILVA%');
  assert.equal(nameSearch('J. SILVA', true), 'J%SILVA%');
  assert.equal(nameSearch('  joão   silva ', true), 'JOÃO%SILVA%');
});

test('curingas digitados continuam literais e nome completo mantém seu formato', () => {
  assert.equal(nameSearch('%_[ TESTE', true), '[%][_][[]%TESTE%');
  assert.equal(nameSearch('joão silva', false), 'JOÃO SILVA');
  assert.throws(() => nameSearch('. .', true), { code: 'INVALID_INPUT' });
});
