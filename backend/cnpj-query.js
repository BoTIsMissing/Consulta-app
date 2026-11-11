// EXISTS evita repetir uma pessoa quando há vários registros PEP correspondentes.
const cnpjQuery = `
  SELECT TOP (50) CONVERT(varchar(20), p.id) AS id,
    p.cpf, p.name, p.birth_date, p.genre
  FROM BR..people p
  WHERE EXISTS (
    SELECT 1 FROM BR..p_pep pep
    WHERE pep.id = p.id
      AND (pep.cnpj IN (@cnpj, @formattedCnpj)
        OR pep.cnpj_relacionamento IN (@cnpj, @formattedCnpj))
  )
  ORDER BY p.name, p.id
`;

module.exports = { cnpjQuery };
