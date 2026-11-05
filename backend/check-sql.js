const sql = require('mssql');
const { getDatabaseConfig } = require('./database-config');

async function checkSqlConnection() {
  const config = await getDatabaseConfig();
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    await pool.request().query('SELECT 1 AS ok');
  } finally {
    await pool.close().catch(() => {});
  }
}

if (require.main === module) {
  checkSqlConnection().then(() => {
    console.log('Arquivo secreto e conexão SQL verificados. Nenhum dado pessoal foi consultado.');
  }).catch(error => {
    console.error(error.code === 'SQL_CONFIGURATION_ERROR'
      ? 'Falha ao carregar as credenciais SQL. Confira o arquivo secreto sql-credentials.json e seu conteúdo.'
      : 'Falha na conexão SQL. Confira IP, porta, acesso de rede, credenciais e certificado TLS do servidor.');
    process.exitCode = 1;
  });
}

module.exports = { checkSqlConnection };
