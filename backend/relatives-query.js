// Identifica o familiar exclusivamente pelo id_relative, sem conferir nome ou CPF.
// O nome informado no vínculo só é exibido como alternativa quando o ID não é localizado.
const relativesQuery = `
  SELECT DISTINCT
    CONVERT(varchar(20), c.id_relative) AS id_relative,
    COALESCE(p.name, LTRIM(RTRIM(c.name_relative))) AS name_relative,
    LTRIM(RTRIM(c.relative)) AS relative,
    CONVERT(varchar(20), p.id) AS id,
    p.cpf, p.birth_date
  FROM BR..p_connected c
  LEFT JOIN BR..people p ON p.id = c.id_relative
  WHERE c.id = @id
`;

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function deduplicateRelatives(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const id = row.id_relative ?? row.id;
    // Sem identificador, não presumir identidade a partir de nome ou documento.
    if (id === null || id === undefined || String(id).trim() === '') return true;
    // Mantém tipos diferentes de parentesco para a mesma pessoa.
    const key = JSON.stringify([String(id).trim(), normalize(row.relative)]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { relativesQuery, deduplicateRelatives };
