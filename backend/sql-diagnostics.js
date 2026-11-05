function getSqlDiagnostic(error) {
  if (error?.code === 'SQL_CONFIGURATION_ERROR') {
    const reasons = {
      FILE_NOT_FOUND: 'O arquivo secreto SQL não foi encontrado no caminho configurado.',
      FILE_PERMISSION: 'O processo não tem permissão para ler o arquivo secreto SQL.',
      FILE_NOT_CONFIGURED: 'O caminho do arquivo secreto SQL não foi configurado.',
      INVALID_JSON: 'O arquivo secreto SQL não contém JSON válido.',
      INVALID_FIELDS: 'O JSON SQL precisa conter user e password como textos não vazios.',
      INVALID_SETTINGS: 'Confira o endereço, a porta e o banco na configuração SQL.',
    };
    return { code: 'SQL_CONFIGURATION_ERROR', message: reasons[error.reason] || 'Não foi possível carregar as credenciais SQL.' };
  }

  const codes = new Set();
  const numbers = new Set();
  const messages = [];
  const seen = new Set();
  const pending = [error];
  while (pending.length && seen.size < 50) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (typeof current.code === 'string') codes.add(current.code);
    if (typeof current.number === 'number') numbers.add(current.number);
    if (typeof current.message === 'string') messages.push(current.message.toLowerCase());
    pending.push(current.cause, current.originalError);
    for (const key of ['errors', 'precedingErrors']) {
      if (Array.isArray(current[key])) pending.push(...current[key].slice(0, 50));
    }
  }
  // Mensagens brutas são usadas só para classificação; nunca saem desta função.
  const text = messages.join(' ');
  const certificateCodes = ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'ERR_TLS_CERT_ALTNAME_INVALID'];
  if (certificateCodes.some(code => codes.has(code))
    || /self[- ]signed certificate|certificate has expired|certificate.*(verify|verification)|does not match certificate|not in the cert/.test(text)) {
    return { code: 'SQL_TLS_CERTIFICATE', message: 'O certificado TLS do SQL não é confiável, expirou ou não corresponde ao endereço utilizado.' };
  }
  if (codes.has('ELOGIN') || numbers.has(18456)) {
    return { code: 'SQL_LOGIN_FAILED', message: 'O SQL rejeitou a autenticação. Confira usuário, senha e o modo de autenticação SQL.' };
  }
  if (numbers.has(4060) || numbers.has(916)) {
    return { code: 'SQL_DATABASE_ACCESS', message: 'O login SQL não consegue acessar o banco configurado.' };
  }
  if (numbers.has(229) || numbers.has(230)) {
    return { code: 'SQL_PERMISSION_DENIED', message: 'O usuário SQL não tem permissão para executar a consulta.' };
  }
  if (numbers.has(207) || numbers.has(208)) {
    return { code: 'SQL_SCHEMA_MISMATCH', message: 'A consulta referencia tabela ou coluna indisponível no banco conectado.' };
  }
  if (codes.has('ETIMEOUT') || codes.has('ETIMEDOUT')) {
    return { code: 'SQL_TIMEOUT', message: 'A conexão ou consulta excedeu o prazo. Confira a rede, o firewall e a disponibilidade do SQL.' };
  }
  if (['ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'EINSTLOOKUP'].some(code => codes.has(code))) {
    return { code: 'SQL_NETWORK', message: 'Falha de rede ao acessar o SQL. Confira endereço, porta, DNS e firewall.' };
  }
  return { code: 'SQL_QUERY_FAILED', message: 'Falha SQL não classificada. Verifique a disponibilidade e os registros do servidor de banco.' };
}

function logSqlError(error, logger = console.error) {
  const diagnostic = getSqlDiagnostic(error);
  logger(`[${diagnostic.code}] ${diagnostic.message}`);
}

module.exports = { getSqlDiagnostic, logSqlError };
