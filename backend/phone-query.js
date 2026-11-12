const phoneQuery = `
  SELECT TOP (50) CONVERT(varchar(20), p.id) AS id,
    p.cpf, p.name, p.birth_date, p.genre
  FROM BR..people p
  WHERE EXISTS (
    SELECT 1 FROM BR..p_fone f
    WHERE f.id = p.id AND f.ddd = @ddd AND f.fone = @fone
  )
  ORDER BY p.name, p.id
`;

module.exports = { phoneQuery };
