const test = require('node:test');
const assert = require('node:assert/strict');
const { relativesQuery, deduplicateRelatives } = require('./relatives-query');

const relative = { id: '2', id_relative: '2', name_relative: 'PESSOA FICTICIA', relative: 'IRMAO', cpf: '00000000001', birth_date: '20000101' };

test('consulta de familiares usa ID e confere o nome sem expandir candidatos por nome', () => {
  assert.match(relativesQuery, /LEFT JOIN BR\.\.people p ON p.id = c.id_relative/);
  assert.match(relativesQuery, /AND p.name COLLATE/);
  assert.match(relativesQuery, /WHERE c.id = @id/);
  assert.doesNotMatch(relativesQuery, /people_doc|people_year|JOIN BR\.\.people p ON p.name/);
  assert.match(relativesQuery, /CONVERT\(varchar\(20\), p.id\)/);
});

test('duplicações com identificadores compatíveis são unificadas, inclusive registros com IDs diferentes', () => {
  const duplicate = { ...relative, id: '3', id_relative: '3', cpf: '000.000.000-01', birth_date: '2000-01-01' };
  assert.deepEqual(deduplicateRelatives([relative, { ...relative }, duplicate]), [relative]);
});

test('homônimos com CPFs diferentes não são fundidos', () => {
  const otherPerson = { ...relative, id: '3', id_relative: '3', cpf: '00000000002' };
  assert.deepEqual(deduplicateRelatives([relative, otherPerson]), [relative, otherPerson]);
});

test('datas conflitantes e tipos de parentesco diferentes são preservados', () => {
  const otherDate = { ...relative, birth_date: '19900101' };
  const otherRelationship = { ...relative, relative: 'PAI' };
  assert.equal(deduplicateRelatives([relative, otherDate, otherRelationship]).length, 3);
});

test('familiares sem identificação ficam no resultado sem enriquecer documentos ou ocultar outros IDs', () => {
  const unresolved = { id: null, id_relative: null, name_relative: 'PESSOA FICTICIA', relative: 'MAE', cpf: null, birth_date: null };
  const otherId = { ...unresolved, id_relative: '3' };
  assert.deepEqual(deduplicateRelatives([unresolved, { ...unresolved }, otherId]), [unresolved, otherId]);
  assert.equal(unresolved.cpf, null);
  assert.equal(unresolved.birth_date, null);
});
