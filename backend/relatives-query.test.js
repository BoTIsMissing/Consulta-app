const test = require('node:test');
const assert = require('node:assert/strict');
const { relativesQuery, deduplicateRelatives } = require('./relatives-query');

const relative = { id: '2', id_relative: '2', name_relative: 'PESSOA FICTICIA', relative: 'IRMAO', cpf: '00000000001', birth_date: '20000101' };

test('consulta de familiares associa pessoas exclusivamente pelo id_relative', () => {
  assert.match(relativesQuery, /LEFT JOIN BR\.\.people p ON p.id = c.id_relative/);
  assert.doesNotMatch(relativesQuery, /AND p.name|ON p.name|WHERE.*cpf|COLLATE/);
  assert.match(relativesQuery, /WHERE c.id = @id/);
  assert.doesNotMatch(relativesQuery, /people_doc|people_year|JOIN BR\.\.people p ON p.name/);
  assert.match(relativesQuery, /CONVERT\(varchar\(20\), p.id\)/);
});

test('mesmo ID e parentesco são unificados sem depender do nome, CPF ou nascimento', () => {
  const duplicate = { ...relative, name_relative: 'NOME ATUALIZADO', cpf: '00000000002', birth_date: '1990-01-01' };
  assert.deepEqual(deduplicateRelatives([relative, { ...relative }, duplicate]), [relative]);
});

test('IDs diferentes não são fundidos mesmo com nome, CPF e nascimento iguais', () => {
  const otherPerson = { ...relative, id: '3', id_relative: '3' };
  assert.deepEqual(deduplicateRelatives([relative, otherPerson]), [relative, otherPerson]);
});

test('tipos de parentesco diferentes para o mesmo ID são preservados', () => {
  const otherRelationship = { ...relative, relative: 'PAI' };
  assert.equal(deduplicateRelatives([relative, otherRelationship]).length, 2);
});

test('familiares sem identificação ficam no resultado sem enriquecer documentos ou ocultar outros IDs', () => {
  const unresolved = { id: null, id_relative: null, name_relative: 'PESSOA FICTICIA', relative: 'MAE', cpf: null, birth_date: null };
  const otherId = { ...unresolved, id_relative: '3' };
  assert.deepEqual(deduplicateRelatives([unresolved, { ...unresolved }, otherId, { ...otherId }]), [unresolved, unresolved, otherId]);
  assert.equal(unresolved.cpf, null);
  assert.equal(unresolved.birth_date, null);
});

test('IDs grandes permanecem distintos sem conversão para Number', () => {
  const first = { ...relative, id_relative: '9007199254740992' };
  const second = { ...relative, id_relative: '9007199254740993' };
  assert.deepEqual(deduplicateRelatives([first, second, { ...first }]), [first, second]);
});
