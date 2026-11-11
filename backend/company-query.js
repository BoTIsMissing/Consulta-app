const sql = require('mssql');

const companyQuery = `SELECT TOP (50) CONVERT(varchar(20), id) AS id,
  cnpj, cnpj8, name1, name2, dt_information, dt_insert, dt_edit, origin
  FROM BR..company WHERE cnpj IN (@cnpj, @formattedCnpj) ORDER BY id`;
const cnesQuery = `SELECT TOP (50) CNPJ AS cnpj, CNES AS cnes
  FROM BR..c_cnes WHERE CNPJ IN (@cnpj, @formattedCnpj) ORDER BY CNES`;

// As tabelas de detalhes usam o ID de company, nunca o ID de people.
const detailQueries = {
  company_profile: `SELECT TOP (50) ty_company, birth_date, legal_nature, matriz,
    share_capital, size, tp_cnae, cnae, cnas2, employees_range, billing_range
    FROM BR..c_profile WHERE id IN ($IDS)`,
  company_address: `SELECT TOP (50) ENDERECO AS endereco, TIPO_LOGR AS tipo_logradouro,
    LOGRADOURO AS logradouro, NUMERO AS numero, COMPLEMENTO AS complemento,
    BAIRRO AS bairro, CIDADE AS cidade, UF AS uf, CEP AS cep, PAIS AS pais,
    CIDADE_EXTERIOR AS cidade_exterior FROM BR..c_address WHERE id IN ($IDS)`,
  company_email: 'SELECT TOP (50) email FROM BR..c_email WHERE id IN ($IDS)',
  company_fone: 'SELECT TOP (50) telefone, ddd, fone, type_fone FROM BR..c_fone WHERE id IN ($IDS)',
  company_partners: `SELECT TOP (50) type_partners, doc_partners, name, dt_entrada,
    qualificacao, participacao, cpf_representante, nome_representante,
    qualificacao_representante, pais, cidade_pais FROM BR..c_partners WHERE id IN ($IDS)`,
  company_representatives: `SELECT TOP (50) type_partners, name, qualificador_cod,
    pais, cidade_pais FROM BR..c_legal_representative WHERE id IN ($IDS)`,
  company_status: `SELECT TOP (50) situacao, situacao_motivo, dt_situacao,
    dt_inicio_atividade, situacao_especial, dt_situacao_especial
    FROM BR..c_status WHERE id IN ($IDS)`,
  company_simples: `SELECT TOP (50) simples, dt_simples, dt_simples_exclusao,
    mei, dt_mei, dt_mei_exclusao FROM BR..c_simples WHERE id IN ($IDS)`,
};

async function settledResults(tasks) {
  const results = await Promise.allSettled(tasks);
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results.map(result => result.value);
}

async function buscarEmpresa(pool, cnpj, formatted) {
  const lookup = query => pool.request()
    .input('cnpj', sql.VarChar(14), cnpj)
    .input('formattedCnpj', sql.VarChar(18), formatted).query(query);
  const [company, cnes] = await settledResults([lookup(companyQuery), lookup(cnesQuery)]);
  if (!company.recordset.length && !cnes.recordset.length) return null;
  const ids = [...new Set(company.recordset.map(row => String(row.id)))];
  const data = { company: company.recordset, cnes: cnes.recordset };
  const entries = Object.entries(detailQueries);
  if (!ids.length) {
    for (const [key] of entries) data[key] = [];
    return data;
  }
  const placeholders = ids.map((_, index) => `@companyId${index}`).join(',');
  const results = await settledResults(entries.map(([, query]) => {
    const request = pool.request();
    ids.forEach((id, index) => request.input(`companyId${index}`, sql.BigInt, id));
    return request.query(query.replace('$IDS', placeholders));
  }));
  entries.forEach(([key], index) => { data[key] = results[index].recordset; });
  return data;
}

module.exports = { buscarEmpresa, companyQuery, cnesQuery, detailQueries, settledResults };
