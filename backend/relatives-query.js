// O nome é uma conferência adicional, nunca a chave para localizar o familiar.
// Não buscar candidatos por nome quando falta um identificador correspondente.
const relativesQuery = `
  SELECT DISTINCT
    CONVERT(varchar(20), c.id_relative) AS id_relative,
    COALESCE(p.name, LTRIM(RTRIM(c.name_relative))) AS name_relative,
    LTRIM(RTRIM(c.relative)) AS relative,
    CONVERT(varchar(20), p.id) AS id,
    p.cpf, p.birth_date
  FROM BR..p_connected c
  LEFT JOIN BR..people p ON p.id = c.id_relative
    AND p.name COLLATE Latin1_General_CI_AI = LTRIM(RTRIM(c.name_relative)) COLLATE Latin1_General_CI_AI
  WHERE c.id = @id
`;

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function deduplicateRelatives(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const cpf = String(row.cpf ?? '').replace(/[.\-\s]/g, '');
    const birthText = row.birth_date instanceof Date ? row.birth_date.toISOString() : normalize(row.birth_date);
    const date = birthText.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:T.*)?$/);
    const birth = date ? `${date[1]}${date[2]}${date[3]}` : birthText;
    // Só une IDs diferentes quando os dados identificadores são compatíveis.
    // CPFs ou datas de nascimento diferentes permanecem como registros distintos.
    const identity = row.id && /^\d{11}$/.test(cpf)
      ? ['cpf', cpf, normalize(row.name_relative), birth]
      : ['id', row.id || row.id_relative || null, normalize(row.name_relative), birth];
    const key = JSON.stringify([...identity, normalize(row.relative)]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { relativesQuery, deduplicateRelatives };
